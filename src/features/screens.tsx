import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
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
import type { Capability, Scenario, Scope } from "../contracts/gateways";
import { environment } from "../config/environment";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});
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
      router.replace({
        pathname: "/units",
        params: { next: safeDestination(params.next) },
      });
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
export function Units() {
  const { state, controller } = useGhost();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [error, setError] = useState("");
  return (
    <Screen
      title="Sua próxima perspectiva"
      subtitle={
        environment.isRemote
          ? "Selecione uma unidade autorizada."
          : "Selecione uma unidade de demonstração."
      }
    >
      {state.bootstrap?.units.map((unit) => (
        <Card key={unit.id}>
          <Label muted size={12}>
            {unit.group} / {unit.brand}
          </Label>
          <Heading>{unit.name}</Heading>
          <Button
            title={`Abrir ${unit.name}`}
            onPress={() =>
              void controller
                .selectUnit(unit.id)
                .then(() => router.replace(safeDestination(next)))
                .catch((e: Error) => setError(e.message))
            }
          />
        </Card>
      ))}
      {!!error && <Label>{error}</Label>}
      <Button
        title={environment.isRemote ? "Sair" : "Sair da demonstração"}
        secondary
        onPress={() =>
          void controller.logout().then(() => router.replace("/login"))
        }
      />
    </Screen>
  );
}
export function DashboardScreen() {
  return (
    <Access capability="dashboard.read">
      <DashboardContent />
    </Access>
  );
}
function DashboardContent() {
  const { state, gateways } = useGhost();
  const scope = useScope();
  const { colors } = useTheme();
  const unit = state.bootstrap?.units.find((u) => u.id === scope.unitId);
  const q = useQuery({
    queryKey: [
      "dashboard",
      scope.session.userId,
      scope.unitId,
      state.generation,
    ],
    queryFn: ({ signal }) => gateways.dashboard.get({ ...scope, signal }),
  });
  return (
    <Screen
      title="Um olhar para o que importa."
      subtitle={
        environment.isRemote
          ? "Visão do mês · dados consolidados pelo KPH"
          : "Visão do dia · dados inteiramente simulados"
      }
    >
      <Button
        title={`${unit?.name}   ⇄ Trocar unidade`}
        secondary
        onPress={() => router.push("/units")}
      />
      {state.mode === "offline" && (
        <Label>Offline simulado • dados podem estar desatualizados</Label>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState message={q.error.message} retry={() => void q.refetch()} />
      ) : (
        <>
          <View
            style={{
              padding: 26,
              borderRadius: 24,
              backgroundColor: colors.accent,
              gap: 14,
            }}
          >
            <Text
              style={{
                color: colors.accentText,
                fontSize: 13,
                letterSpacing: 1,
              }}
            >
              FATURAMENTO{environment.isRemote ? "" : " · DEMO"}
            </Text>
            <Text
              style={{
                color: colors.accentText,
                fontSize: 38,
                fontWeight: "600",
                fontVariant: ["tabular-nums"],
              }}
            >
              {q.data.revenue === null
                ? "Sem dados"
                : money.format(q.data.revenue)}
            </Text>
            <Text style={{ color: colors.accentText }}>
              {q.data.goalProgress === null
                ? "Sem meta disponível"
                : `${percent.format(q.data.goalProgress)} da meta`}
            </Text>
          </View>
          <Card>
            <Label size={22}>{q.data.summary}</Label>
            <Label muted>Consulte os avisos e organize sua próxima ação.</Label>
          </Card>
          <Label muted size={12}>
            Atualização: {new Date(q.data.updatedAt).toLocaleString("pt-BR")}
          </Label>
        </>
      )}
      <CapabilityButton
        capability="pending.read"
        title="Ver pendências"
        path="/pending"
      />
      <CapabilityButton
        capability="notifications.read"
        title="Central de notificações"
        path="/notifications"
      />
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
  path: "/pending" | "/notifications";
}) {
  const { controller } = useGhost();
  return controller.can(capability) ? (
    <Button title={title} onPress={() => router.push(path)} />
  ) : null;
}
export function PendingScreen() {
  return (
    <Access capability="pending.read">
      <PendingContent />
    </Access>
  );
}
function PendingContent() {
  const { state, gateways } = useGhost();
  const scope = useScope();
  const q = useQuery({
    queryKey: ["pending", scope.session.userId, scope.unitId, state.generation],
    queryFn: ({ signal }) => gateways.pending.list({ ...scope, signal }),
  });
  return (
    <Screen
      title="O que pede sua atenção"
      subtitle={
        environment.isRemote
          ? "Itens autorizados para consulta nesta unidade"
          : "Pendências simuladas • sem ações financeiras"
      }
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState message={q.error.message} retry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <Empty />
      ) : (
        q.data.map((p) => (
          <Card key={p.id}>
            <Label muted size={12}>
              {p.priority === "attention" ? "ATENÇÃO" : "PARA REVISAR"}
            </Label>
            <Label size={22}>{p.title}</Label>
            <Label muted>{p.detail}</Label>
          </Card>
        ))
      )}
    </Screen>
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
  const q = useQuery({
    queryKey: [
      "notifications",
      scope.session.userId,
      scope.unitId,
      state.generation,
    ],
    queryFn: ({ signal }) => gateways.notifications.list({ ...scope, signal }),
  });
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
      ) : q.data.length === 0 ? (
        <Empty
          text={
            environment.isRemote
              ? "Você não possui notificações."
              : "Sem notificações nesta simulação."
          }
        />
      ) : (
        q.data.map((n) => (
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
      <Screen
        title={
          kind === "people"
            ? "Pessoas, em primeiro lugar."
            : "A operação, mais perto."
        }
        subtitle={
          environment.isRemote ? "Acesso validado pelo KPH" : "Fundação local"
        }
      >
        <Empty
          text={
            environment.isRemote
              ? "Nenhum resumo foi publicado para este módulo."
              : "As jornadas deste módulo serão conectadas nas próximas fases. Nenhuma consulta ao KPH é feita aqui."
          }
        />
      </Screen>
    </Access>
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
      <Button
        title="Trocar unidade"
        secondary
        onPress={() => router.push("/units")}
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
