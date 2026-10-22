import type {
  Gateways,
  Scope,
  Capability,
  Session,
  DataMode,
  NotificationPreferences,
  DecidePendingInput,
  PendingDecisionResult,
} from "../contracts/gateways";
import { demo } from "./fixtures";
export function createMockGateways(now = Date.now, delay = 240): Gateways {
  let mode: DataMode = "normal";
  const read = new Set<string>();
  const decided = new Set<string>();
  const decisions = new Map<
    string,
    { input: DecidePendingInput; result: PendingDecisionResult }
  >();
  let preferences: NotificationPreferences = {
    categories: ["pending", "operation", "people", "system"],
    quietStart: null,
    quietEnd: null,
    timezone: "America/Sao_Paulo",
    version: 0,
  };
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delay));
  const bootstrap = (session: Session) => ({
    status:
      session.scenario === "inactive"
        ? ("inactive" as const)
        : session.scenario === "unlinked"
          ? ("unlinked" as const)
          : ("active" as const),
    units:
      session.scenario === "inactive" || session.scenario === "unlinked"
        ? []
        : demo.units.map((u) => ({
            ...u,
            capabilities:
              session.scenario === "restricted"
                ? u.capabilities.filter((c) => c === "dashboard.read")
                : [...u.capabilities],
          })),
    accessVersion: `demo-${session.scenario ?? "active"}`,
  });
  async function check(scope: Scope, capability: Capability) {
    await wait();
    if (scope.signal?.aborted) throw new Error("Consulta cancelada.");
    if (scope.session.expiresAt <= now()) throw new Error("Sessão expirada.");
    if (
      !bootstrap(scope.session)
        .units.find((u) => u.id === scope.unitId)
        ?.capabilities.includes(capability)
    )
      throw new Error("Acesso não permitido.");
    if (mode === "offline")
      throw new Error(
        "Você está offline na simulação. Reconecte nas preferências.",
      );
    if (mode === "error")
      throw new Error(
        "Falha simulada. Restaure o modo normal nas preferências e tente novamente.",
      );
  }
  return {
    auth: {
      async restore() {
        return null;
      },
      async signIn(email, password, scenario) {
        await wait();
        if (email !== "demo@ghost.invalid" || password !== "ghost-demo")
          throw new Error("Use a conta de demonstração indicada.");
        return {
          userId: `demo-${scenario}`,
          displayName: demo.displayName,
          expiresAt: now() + 3_600_000,
          scenario: scenario ?? "active",
        };
      },
      async recover(email) {
        await wait();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
          throw new Error("Informe um e-mail válido.");
      },
      async completeRecovery() {},
      async updatePassword() {},
      async signOut() {
        read.clear();
      },
    },
    bootstrap: {
      async load(session) {
        await wait();
        return bootstrap(session);
      },
    },
    dashboard: {
      async get(scope) {
        await check(scope, "dashboard.read");
        return mode === "empty"
          ? {
              updatedAt: "2026-10-20T12:00:00Z",
              revenue: null,
              goal: null,
              goalProgress: null,
              hasData: false,
              summary: "Nenhum fechamento neste período simulado.",
            }
          : demo.dashboards[scope.unitId as keyof typeof demo.dashboards];
      },
    },
    pending: {
      async list(scope, cursor) {
        await check(scope, "pending.read");
        const items =
          mode === "empty" || cursor
            ? []
            : demo.pending
                .filter((p) => !decided.has(`${scope.unitId}:${p.id}`))
                .map((p) => ({
                  ...p,
                  canDecide:
                    bootstrap(scope.session)
                      .units.find((u) => u.id === scope.unitId)
                      ?.capabilities.includes(
                        p.kind === "maintenance"
                          ? "maintenance.decide"
                          : "punch.decide",
                      ) ?? false,
                }));
        return { items, nextCursor: null, updatedAt: "2026-10-20T12:00:00Z" };
      },
      async decide(scope, input) {
        const item = demo.pending.find(
          (candidate) => candidate.id === input.itemId,
        );
        if (!item) throw new Error("Pendência não encontrada.");
        await check(
          scope,
          item.kind === "maintenance" ? "maintenance.decide" : "punch.decide",
        );
        const key = `${scope.session.userId}:${input.idempotencyKey}`;
        const replay = decisions.get(key);
        if (replay) {
          if (JSON.stringify(replay.input) !== JSON.stringify(input))
            throw new Error("Conflito de idempotência.");
          return { ...replay.result };
        }
        if (input.expectedVersion !== item.version)
          throw new Error("A pendência mudou. Atualize a lista.");
        const resourceKey = `${scope.unitId}:${input.itemId}`;
        if (decided.has(resourceKey))
          throw new Error("A pendência já foi decidida.");
        if (input.decision === "reject" && !input.reason?.trim())
          throw new Error("Informe o motivo da rejeição.");
        const result: PendingDecisionResult = {
          itemId: input.itemId,
          state: input.decision === "approve" ? "approved" : "rejected",
          version: `${item.version}-${input.decision}`,
          decidedAt: "2026-10-20T12:00:00Z",
        };
        decided.add(resourceKey);
        decisions.set(key, { input: { ...input }, result });
        return { ...result };
      },
    },
    operation: {
      async get(scope) {
        await check(scope, "operation.read");
        return mode === "empty"
          ? {
              ...demo.operation,
              pendingMaintenance: 0,
              attentionMaintenance: 0,
              oldestPendingDate: null,
            }
          : { ...demo.operation };
      },
    },
    people: {
      async get(scope) {
        await check(scope, "people.read");
        return mode === "empty"
          ? { ...demo.people, headcount: 0, pendingPunchAdjustments: 0 }
          : { ...demo.people };
      },
    },
    assistant: {
      async ask(session, question, _history, signal) {
        await wait();
        if (signal?.aborted) throw new Error("Consulta cancelada.");
        if (session.expiresAt <= now()) throw new Error("Sessão expirada.");
        const units = bootstrap(session).units.filter((unit) =>
          unit.capabilities.includes("assistant.ask"),
        );
        if (!units.length) throw new Error("Acesso não permitido.");
        if (!question.trim()) throw new Error("Escreva uma pergunta.");
        const revenue = units.reduce(
          (total, unit) =>
            total +
            (demo.dashboards[unit.id as keyof typeof demo.dashboards]
              ?.revenue ?? 0),
          0,
        );
        return {
          answer: `Na demonstração, consultei ${units.length} casas. O faturamento consolidado é ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(revenue)} e existem ${demo.operation.pendingMaintenance} manutenções pendentes.`,
          sources: ["Dashboard de todas as casas", "Operação"],
          updatedAt: "2026-10-20T12:00:00Z",
        };
      },
    },
    notifications: {
      async list(scope, cursor) {
        await check(scope, "notifications.read");
        const items =
          mode === "empty" || cursor
            ? []
            : demo.notifications.map((n) => ({
                ...n,
                read: read.has(`${scope.unitId}:${n.id}`),
              }));
        return { items, nextCursor: null, updatedAt: "2026-10-20T12:00:00Z" };
      },
      async markRead(scope, id) {
        await check(scope, "notifications.read");
        if (!demo.notifications.some((n) => n.id === id))
          throw new Error("Aviso não encontrado.");
        read.add(`${scope.unitId}:${id}`);
      },
      async register() {
        await wait();
      },
      async reconcile() {
        await wait();
        return false;
      },
      async unregister() {
        read.clear();
      },
      async getPreferences() {
        await wait();
        return { ...preferences, categories: [...preferences.categories] };
      },
      async updatePreferences(_session, next) {
        await wait();
        preferences = {
          ...next,
          categories: [...next.categories],
          version: preferences.version + 1,
        };
        return { ...preferences, categories: [...preferences.categories] };
      },
    },
    simulation: {
      setMode(next) {
        mode = next;
      },
      reset() {
        mode = "normal";
        read.clear();
      },
    },
  };
}
