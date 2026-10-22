import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import * as LocalAuthentication from "expo-local-authentication";
import { useGhost } from "../state/provider";
import { safeDestination } from "../state/controller";
import { useTheme } from "../ui/theme";
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Field,
  Heading,
  Label,
  Loading,
  Screen,
} from "../ui/components";
import type {
  Capability,
  AssistantMessage,
  NotificationCategory,
  NotificationPreferences,
  OperationSummary,
  PeopleSummary,
  Scenario,
  Scope,
} from "../contracts/gateways";
import { environment } from "../config/environment";
import { DashboardExperience } from "./dashboard-experience";
import { PayablesExperience } from "./payables-experience";

function useScope() {
  const { state } = useGhost();
  if (!state.session || !state.unitId) throw new Error("Contexto ausente");
  return { session: state.session, unitId: state.unitId };
}
export function Access({
  capability,
  children,
}: React.PropsWithChildren<{ capability: Capability }>) {
  const { controller } = useGhost();
  return controller.can(capability) ? (
    <>{children}</>
  ) : (
    <Screen title="Acesso restrito">
      <Empty text="Este módulo não está disponível para seu vínculo nesta unidade." />
    </Screen>
  );
}
function PortfolioAccess({ children }: React.PropsWithChildren) {
  const { controller } = useGhost();
  return controller.canAny("assistant.ask") ? (
    <>{children}</>
  ) : (
    <Screen title="Acesso restrito">
      <Empty text="O assistente não está disponível para seus vínculos." />
    </Screen>
  );
}
export function Login() {
  const { controller, state } = useGhost();
  const params = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState(
    environment.isRemote ? "" : "demo@ghost.invalid",
  );
  const [password, setPassword] = useState(
    environment.isRemote ? "" : "ghost-demo",
  );
  const [scenario, setScenario] = useState<Scenario>("active");
  async function login() {
    await controller.login(
      email,
      password,
      environment.isRemote ? undefined : scenario,
    );
    if (controller.state.status === "ready")
      router.replace(safeDestination(params.next));
    else if (["unlinked", "inactive"].includes(controller.state.status))
      router.replace("/status");
  }
  return (
    <Screen
      title="Clareza para a próxima decisão."
      subtitle="Seu espaço de gestão, onde você estiver."
    >
      <Card>
        <Label size={20}>Entrar no Ghost</Label>
        <Label muted size={13}>
          {environment.isRemote
            ? "Use seu acesso KPH. Sua unidade e permissões serão validadas pelo servidor."
            : "Ambiente isolado. Use apenas demo@ghost.invalid e ghost-demo. Nenhum dado será enviado."}
        </Label>
        {state.status === "expired" && (
          <Label>Sessão expirada. Entre novamente.</Label>
        )}
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label={environment.isRemote ? "Senha" : "Senha de demonstração"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {state.error && <Text accessibilityRole="alert">{state.error}</Text>}
        <Button
          title={
            state.status === "loading"
              ? "Entrando…"
              : environment.isRemote
                ? "Entrar"
                : "Entrar na demonstração"
          }
          disabled={state.status === "loading"}
          onPress={() => void login()}
        />
        <Button
          title="Recuperar senha"
          secondary
          onPress={() => router.push("/recover")}
        />
      </Card>
      {!environment.isRemote && (
        <>
          <Label muted size={12}>
            CENÁRIO DE ACESSO
          </Label>
          <View style={{ gap: 8 }}>
            {(
              [
                ["active", "Usuário ativo"],
                ["restricted", "Acesso restrito"],
                ["unlinked", "Sem vínculo"],
                ["inactive", "Usuário inativo"],
              ] as const
            ).map(([id, title]) => (
              <Button
                key={id}
                title={`${scenario === id ? "● " : ""}${title}`}
                secondary
                onPress={() => setScenario(id)}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
export function Recover() {
  const { gateways } = useGhost();
  const [email, setEmail] = useState(
    environment.isRemote ? "" : "demo@ghost.invalid",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Screen
      title="Recuperar acesso"
      subtitle={
        environment.isRemote
          ? "Enviaremos um link seguro para redefinir sua senha."
          : "Fluxo simulado, sem envio de e-mail."
      }
    >
      <Card>
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        {!!message && <Label>{message}</Label>}
        <Button
          title={environment.isRemote ? "Enviar link" : "Simular recuperação"}
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void gateways.auth
              .recover(email)
              .then(() =>
                setMessage(
                  environment.isRemote
                    ? "Se o e-mail estiver cadastrado, você receberá as instruções."
                    : "Solicitação simulada concluída. Nenhum e-mail foi enviado.",
                ),
              )
              .catch((e: Error) => setMessage(e.message))
              .finally(() => setBusy(false));
          }}
        />
        <Button
          title="Voltar ao login"
          secondary
          onPress={() => router.replace("/login")}
        />
      </Card>
    </Screen>
  );
}
export function Status() {
  const { state, controller } = useGhost();
  return (
    <Screen
      title={
        state.status === "inactive"
          ? "Acesso pausado"
          : "Vamos encontrar seu lugar."
      }
      subtitle={
        state.status === "inactive"
          ? environment.isRemote
            ? "Seu acesso está inativo. Procure um administrador KPH."
            : "Este usuário simulado está inativo."
          : environment.isRemote
            ? "Nenhuma unidade ativa está vinculada a este usuário."
            : "Nenhuma unidade vinculada a este usuário simulado."
      }
    >
      <Card>
        <Label muted>
          {environment.isRemote
            ? "Um administrador do KPH deverá revisar seu vínculo."
            : "Em um ambiente real, o administrador do KPH deverá revisar seu vínculo."}
        </Label>
        <Button
          title="Voltar ao login"
          onPress={() =>
            void controller.logout().then(() => router.replace("/login"))
          }
        />
      </Card>
    </Screen>
  );
}
export function DashboardScreen() {
  const { controller } = useGhost();
  return controller.canAny("dashboard.read") ? (
    <DashboardExperience />
  ) : (
    <Screen title="Acesso restrito">
      <Empty text="O dashboard não está disponível para seus vínculos." />
    </Screen>
  );
}
function CapabilityButton({
  capability,
  title,
  path,
}: {
  capability: Capability;
  title: string;
  path: "/pending" | "/notifications" | "/assistant";
}) {
  const { controller } = useGhost();
  return controller.can(capability) ? (
    <Button title={title} onPress={() => router.push(path)} />
  ) : null;
}
export function PendingScreen() {
  return (
    <Access capability="dashboard.read">
      <PayablesExperience />
    </Access>
  );
}
export function NotificationsScreen() {
  return (
    <Access capability="notifications.read">
      <NotificationsContent />
    </Access>
  );
}
function NotificationsContent() {
  const { state, gateways, controller } = useGhost();
  const scope = useScope();
  const [error, setError] = useState("");
  const [registrationMessage, setRegistrationMessage] = useState("");
  const q = useInfiniteQuery({
    queryKey: [
      "notifications",
      scope.session.userId,
      scope.unitId,
      state.generation,
    ],
    queryFn: ({ signal, pageParam }) =>
      gateways.notifications.list({ ...scope, signal }, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((page) => page.items) ?? [];
  async function open(id: string, target: "/" | "/pending") {
    try {
      await gateways.notifications.markRead(scope as Scope, id);
      await q.refetch();
      router.push(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir.");
    }
  }
  return (
    <Screen
      title="No seu radar"
      subtitle={
        environment.isRemote
          ? "Avisos vinculados ao seu usuário"
          : "Central simulada. Nenhum push real é enviado."
      }
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState message={q.error.message} retry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <Empty
          text={
            environment.isRemote
              ? "Você não possui notificações."
              : "Sem notificações nesta simulação."
          }
        />
      ) : (
        items.map((n) => (
          <Card key={n.id}>
            <Label muted size={12}>
              {n.read ? "LIDA" : "NOVA"}
            </Label>
            <Label size={22}>{n.title}</Label>
            <Label muted>{n.body}</Label>
            <Button
              title="Abrir aviso"
              secondary
              onPress={() => void open(n.id, n.target)}
            />
          </Card>
        ))
      )}
      {q.hasNextPage && (
        <Button
          title={q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          secondary
          disabled={q.isFetchingNextPage}
          onPress={() => void q.fetchNextPage()}
        />
      )}
      {!!error && <Label>{error}</Label>}
      <Card>
        <Label>Receba avisos relevantes para sua unidade.</Label>
        <Label muted>
          {environment.isRemote
            ? "Ao ativar, o sistema pedirá permissão e registrará somente este aparelho."
            : "Esta opção apenas simula um vínculo de dispositivo. Não solicita permissão do sistema."}
        </Label>
        <Button
          title={
            state.registered
              ? "Dispositivo registrado"
              : environment.isRemote
                ? "Ativar notificações"
                : "Simular registro de dispositivo"
          }
          disabled={state.registered}
          onPress={() => {
            setRegistrationMessage("");
            void controller
              .register()
              .then(() => setRegistrationMessage("Notificações ativadas."))
              .catch((cause: unknown) =>
                setRegistrationMessage(
                  cause instanceof Error
                    ? cause.message
                    : "Não foi possível ativar notificações.",
                ),
              );
          }}
        />
        {!!registrationMessage && <Label>{registrationMessage}</Label>}
      </Card>
    </Screen>
  );
}
export function ModuleScreen({ kind }: { kind: "operation" | "people" }) {
  return (
    <Access capability={kind === "people" ? "people.read" : "operation.read"}>
      <ModuleContent kind={kind} />
    </Access>
  );
}
function ModuleContent({ kind }: { kind: "operation" | "people" }) {
  const { state, gateways } = useGhost();
  const scope = useScope();
  const q = useQuery<OperationSummary | PeopleSummary>({
    queryKey: [kind, scope.session.userId, scope.unitId, state.generation],
    queryFn: ({ signal }) =>
      kind === "operation"
        ? gateways.operation.get({ ...scope, signal })
        : gateways.people.get({ ...scope, signal }),
  });
  return (
    <Screen
      title={
        kind === "people"
          ? "Pessoas, em primeiro lugar."
          : "A operação, mais perto."
      }
      subtitle="Resumo mínimo autorizado para esta unidade"
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState message={q.error.message} retry={() => void q.refetch()} />
      ) : kind === "operation" && "pendingMaintenance" in q.data ? (
        <>
          <Card>
            <Label muted size={12}>
              MANUTENÇÕES PENDENTES
            </Label>
            <Label size={34}>{q.data.pendingMaintenance}</Label>
            <Label muted>
              {q.data.attentionMaintenance} com prioridade alta ou urgente
            </Label>
          </Card>
          <Card>
            <Label>Mais antiga</Label>
            <Label muted>
              {q.data.oldestPendingDate
                ? new Date(
                    `${q.data.oldestPendingDate}T12:00:00`,
                  ).toLocaleDateString("pt-BR")
                : "Nenhuma pendência"}
            </Label>
          </Card>
        </>
      ) : "headcount" in q.data ? (
        <>
          <Card>
            <Label muted size={12}>
              COLABORADORES NA UNIDADE
            </Label>
            <Label size={34}>{q.data.headcount}</Label>
          </Card>
          <Card>
            <Label>Ajustes de ponto pendentes</Label>
            <Label size={28}>{q.data.pendingPunchAdjustments}</Label>
            <Label muted>
              Somente contagens. Nenhum dado pessoal é enviado ao app.
            </Label>
          </Card>
        </>
      ) : null}
      {q.data && (
        <Label muted size={12}>
          Atualização: {new Date(q.data.updatedAt).toLocaleString("pt-BR")}
        </Label>
      )}
    </Screen>
  );
}
export function More() {
  const { state, controller } = useGhost();
  return (
    <Screen title="Seu espaço" subtitle={state.session?.displayName}>
      <Button
        title="Meu perfil"
        secondary
        onPress={() => router.push("/profile")}
      />
      <Button
        title={
          environment.isRemote ? "Preferências" : "Preferências e simulação"
        }
        secondary
        onPress={() => router.push("/preferences")}
      />
      <CapabilityButton
        capability="notifications.read"
        title="Notificações"
        path="/notifications"
      />
      {__DEV__ && (
        <Button
          title="Catálogo de componentes"
          secondary
          onPress={() => router.push("/catalog")}
        />
      )}
      <Button
        title={environment.isRemote ? "Sair" : "Sair da demonstração"}
        onPress={() =>
          void controller.logout().then(() => router.replace("/login"))
        }
      />
    </Screen>
  );
}

export function AssistantScreen() {
  return (
    <PortfolioAccess>
      <AssistantContent />
    </PortfolioAccess>
  );
}

function AssistantContent() {
  const { state, gateways } = useGhost();
  const { colors } = useTheme();
  const session = state.session!;
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: ({
      prompt,
      history,
    }: {
      prompt: string;
      history: AssistantMessage[];
    }) => gateways.assistant.ask(session, prompt, history),
    onSuccess: (result) => {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer },
      ]);
      setSources(result.sources);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível responder agora.",
      ),
  });
  function ask(text = question) {
    const prompt = text.trim();
    if (!prompt || mutation.isPending) return;
    const history = messages.slice(-8);
    setError("");
    setSources([]);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    mutation.mutate({ prompt, history });
  }
  return (
    <Screen
      title="Ghost IA"
      subtitle="Conversa com a visão de todas as suas empresas autorizadas"
    >
      {messages.length === 0 && (
        <>
          <View
            accessibilityLabel="Mensagem do Ghost"
            style={{
              alignSelf: "stretch",
              borderRadius: 18,
              padding: 16,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
              Olá. Posso analisar suas casas em conjunto ou comparar os dados
              que você tem permissão para ver. O que você quer saber?
            </Text>
          </View>
          <Label muted>Sugestões para começar</Label>
          <Button
            title="Como estão minhas empresas este mês?"
            secondary
            onPress={() =>
              ask("Como estão minhas empresas em faturamento e meta este mês?")
            }
          />
          <Button
            title="Qual casa precisa de mais atenção?"
            secondary
            onPress={() =>
              ask("Qual casa precisa de mais atenção agora e por quê?")
            }
          />
        </>
      )}
      {messages.map((message, index) => (
        <View
          key={`${message.role}-${index}`}
          accessibilityLabel={
            message.role === "user" ? "Sua pergunta" : "Resposta do Ghost"
          }
          style={{
            alignSelf: message.role === "user" ? "flex-end" : "stretch",
            maxWidth: message.role === "user" ? "88%" : "100%",
            borderRadius: 18,
            padding: 16,
            backgroundColor:
              message.role === "user" ? colors.accent : colors.surface,
            borderWidth: message.role === "assistant" ? 1 : 0,
            borderColor: colors.line,
          }}
        >
          <Text
            style={{
              color: message.role === "user" ? colors.accentText : colors.text,
              fontSize: 16,
              lineHeight: 24,
            }}
          >
            {message.content}
          </Text>
        </View>
      ))}
      {mutation.isPending && <Loading />}
      {!!sources.length && (
        <Label muted size={12}>
          Fontes: {sources.join(" · ")}
        </Label>
      )}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Card>
        <Field
          label="Sua pergunta"
          value={question}
          onChangeText={setQuestion}
          placeholder="Converse com o Ghost…"
          multiline
          maxLength={1000}
        />
        <Button
          title={mutation.isPending ? "Analisando…" : "Perguntar"}
          disabled={mutation.isPending || !question.trim()}
          onPress={() => ask()}
        />
        <Label muted size={12}>
          As respostas podem conter imprecisões. Confira os números nas telas de
          origem antes de tomar uma decisão.
        </Label>
      </Card>
    </Screen>
  );
}
export function Profile() {
  const { state } = useGhost();
  return (
    <Screen title="Meu perfil">
      <Card>
        <Label size={24}>{state.session?.displayName}</Label>
        <Label muted>
          {environment.isRemote
            ? "Identidade validada pelo Supabase Auth"
            : "Identidade fictícia • sessão mantida somente em memória"}
        </Label>
        <Label>
          {state.bootstrap?.units.length} unidades autorizadas pelo gateway
        </Label>
      </Card>
      <Button
        title="Voltar"
        secondary
        onPress={() => router.replace("/more")}
      />
    </Screen>
  );
}

const categoryLabels: Record<NotificationCategory, string> = {
  pending: "Pendências",
  operation: "Operação",
  people: "Pessoas",
  system: "Sistema",
};

function NotificationPreferencesCard() {
  const { controller, gateways, state } = useGhost();
  const session = state.session;
  const allowed = controller.can("notifications.read");
  const query = useQuery({
    queryKey: ["notification-preferences", session?.userId],
    queryFn: () => gateways.notifications.getPreferences(session!),
    enabled: !!session && allowed,
  });
  if (!allowed || !session) return null;
  if (query.isError)
    return (
      <ErrorState
        message="Não foi possível carregar as preferências."
        retry={() => void query.refetch()}
      />
    );
  if (query.isPending || !query.data)
    return (
      <Card>
        <Label muted>Carregando preferências de notificações…</Label>
      </Card>
    );
  return (
    <NotificationPreferencesEditor
      key={query.data.version}
      initial={query.data}
      save={(preferences) =>
        gateways.notifications.updatePreferences(session, preferences)
      }
    />
  );
}

function NotificationPreferencesEditor({
  initial,
  save: persist,
}: {
  initial: NotificationPreferences;
  save: (
    preferences: NotificationPreferences,
  ) => Promise<NotificationPreferences>;
}) {
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: persist,
    onSuccess: (preferences) => {
      setDraft(preferences);
      setMessage("Preferências salvas.");
    },
    onError: (cause) =>
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      ),
  });

  function toggle(category: NotificationCategory) {
    setDraft({
      ...draft,
      categories: draft.categories.includes(category)
        ? draft.categories.filter((item) => item !== category)
        : [...draft.categories, category],
    });
  }
  function save() {
    setMessage("");
    const validTime = /^\d{2}:\d{2}$/;
    if (
      (draft.quietStart === null) !== (draft.quietEnd === null) ||
      (draft.quietStart !== null &&
        (!validTime.test(draft.quietStart) || !validTime.test(draft.quietEnd!)))
    ) {
      setMessage(
        "Preencha início e fim no formato HH:MM, ou deixe ambos vazios.",
      );
      return;
    }
    mutation.mutate(draft);
  }
  return (
    <Card>
      <Label size={20}>Notificações</Label>
      <Label muted>Escolha categorias e um horário silencioso.</Label>
      {(Object.keys(categoryLabels) as NotificationCategory[]).map(
        (category) => (
          <Button
            key={category}
            secondary
            title={`${draft.categories.includes(category) ? "● " : "○ "}${categoryLabels[category]}`}
            onPress={() => toggle(category)}
          />
        ),
      )}
      <Field
        label="Silêncio começa (HH:MM)"
        placeholder="22:00"
        value={draft.quietStart ?? ""}
        onChangeText={(value) =>
          setDraft({ ...draft, quietStart: value || null })
        }
      />
      <Field
        label="Silêncio termina (HH:MM)"
        placeholder="07:00"
        value={draft.quietEnd ?? ""}
        onChangeText={(value) =>
          setDraft({ ...draft, quietEnd: value || null })
        }
      />
      <Field
        label="Fuso horário"
        value={draft.timezone}
        onChangeText={(timezone) => setDraft({ ...draft, timezone })}
      />
      <Button
        title={mutation.isPending ? "Salvando…" : "Salvar notificações"}
        disabled={mutation.isPending}
        onPress={save}
      />
      {!!message && <Label>{message}</Label>}
    </Card>
  );
}

export function Preferences() {
  const theme = useTheme();
  const { controller, state } = useGhost();
  const [message, setMessage] = useState("");
  async function biometric() {
    setMessage("");
    try {
      if (state.biometric) {
        controller.setBiometric(false);
        return;
      }
      if (
        !(await LocalAuthentication.hasHardwareAsync()) ||
        !(await LocalAuthentication.isEnrolledAsync())
      ) {
        setMessage(
          "Biometria indisponível ou não cadastrada neste dispositivo.",
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Ativar bloqueio do Ghost",
        disableDeviceFallback: true,
      });
      if (result.success) {
        controller.setBiometric(true);
        setMessage("Bloqueio biométrico ativado.");
      } else setMessage("Ativação cancelada.");
    } catch {
      setMessage("Biometria não suportada neste ambiente.");
    }
  }
  return (
    <Screen
      title="Do seu jeito"
      subtitle={
        environment.isRemote
          ? "Preferências deste aparelho"
          : "Preferências desta sessão local"
      }
    >
      <Card>
        <Label size={20}>Aparência</Label>
        {(["system", "light", "dark"] as const).map((m, i) => (
          <Button
            key={m}
            secondary
            title={`${theme.mode === m ? "● " : ""}${["Sistema", "Claro", "Escuro"][i]}`}
            onPress={() => theme.setMode(m)}
          />
        ))}
      </Card>
      <Card>
        <Label size={20}>Privacidade local</Label>
        <Button
          title={
            state.biometric
              ? "Desativar biometria"
              : "Ativar bloqueio biométrico"
          }
          secondary
          onPress={() => void biometric()}
        />
        {state.biometric && (
          <Button
            title="Bloquear agora"
            onPress={() => {
              controller.lock();
              router.replace("/lock");
            }}
          />
        )}
        {!!message && <Label>{message}</Label>}
      </Card>
      <NotificationPreferencesCard />
      {!environment.isRemote && (
        <Card>
          <Label size={20}>Laboratório de estados</Label>
          <Label muted>
            Controles locais, sem alterar conexão ou serviços reais.
          </Label>
          {(["normal", "empty", "error", "offline"] as const).map((m, i) => (
            <Button
              key={m}
              title={`${state.mode === m ? "● " : ""}${["Normal", "Vazio", "Erro", "Offline"][i]}`}
              secondary
              onPress={() => void controller.setMode(m)}
            />
          ))}
          <Button
            title="Simular sessão expirada"
            onPress={() =>
              void controller.logout(true).then(() => router.replace("/login"))
            }
          />
        </Card>
      )}
    </Screen>
  );
}
export function Lock() {
  const { controller } = useGhost();
  const [message, setMessage] = useState("");
  return (
    <Screen
      title="Seu espaço está protegido."
      subtitle="Desbloqueie para continuar."
    >
      <Button
        title="Desbloquear com biometria"
        onPress={() =>
          void LocalAuthentication.authenticateAsync({
            promptMessage: "Desbloquear Ghost",
            disableDeviceFallback: true,
          })
            .then((result) => {
              if (result.success) {
                controller.unlock();
                router.replace("/");
              } else setMessage("O aplicativo permanece bloqueado.");
            })
            .catch(() =>
              setMessage("Não foi possível usar biometria. Entre novamente."),
            )
        }
      />
      {!!message && <Label>{message}</Label>}
      <Button
        title="Sair e entrar novamente"
        secondary
        onPress={() =>
          void controller.logout().then(() => router.replace("/login"))
        }
      />
    </Screen>
  );
}
export function Catalog() {
  return (
    <Screen
      title="Elementos do Ghost"
      subtitle="Catálogo interno • somente desenvolvimento"
    >
      <Card>
        <Heading>Tipografia</Heading>
        <Label>Texto principal, claro e acessível.</Label>
        <Label muted>Texto secundário.</Label>
      </Card>
      <Button title="Botão principal" onPress={() => {}} />
      <Button title="Botão secundário" secondary onPress={() => {}} />
      <Button title="Indisponível" disabled onPress={() => {}} />
      <Field label="Campo de exemplo" placeholder="Dado sintético" />
      <Loading />
      <Empty />
      <ErrorState message="Erro de demonstração" retry={() => {}} />
    </Screen>
  );
}
