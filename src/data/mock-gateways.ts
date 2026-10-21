import type {
  Gateways,
  Scope,
  Capability,
  Session,
  DataMode,
} from "../contracts/gateways";
import { demo } from "./fixtures";
export function createMockGateways(now = Date.now, delay = 240): Gateways {
  let mode: DataMode = "normal";
  const read = new Set<string>();
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
      async list(scope) {
        await check(scope, "pending.read");
        return mode === "empty" ? [] : demo.pending.map((p) => ({ ...p }));
      },
    },
    notifications: {
      async list(scope) {
        await check(scope, "notifications.read");
        return mode === "empty"
          ? []
          : demo.notifications.map((n) => ({
              ...n,
              read: read.has(`${scope.unitId}:${n.id}`),
            }));
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
      async unregister() {
        read.clear();
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
