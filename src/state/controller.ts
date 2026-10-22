import type { QueryClient } from "@tanstack/react-query";
import type {
  Gateways,
  Session,
  Bootstrap,
  Scenario,
  Capability,
  DataMode,
} from "../contracts/gateways";
import type { LocalStorage } from "../security/storage";
export type State = {
  status:
    | "starting"
    | "signedOut"
    | "loading"
    | "ready"
    | "unlinked"
    | "inactive"
    | "expired";
  session: Session | null;
  bootstrap: Bootstrap | null;
  unitId: string | null;
  generation: number;
  locked: boolean;
  biometric: boolean;
  registered: boolean;
  mode: DataMode;
  error: string | null;
};
const initial: State = {
  status: "starting",
  session: null,
  bootstrap: null,
  unitId: null,
  generation: 0,
  locked: false,
  biometric: false,
  registered: false,
  mode: "normal",
  error: null,
};
export class Controller {
  state: State = { ...initial };
  private listeners = new Set<() => void>();
  private operation = 0;
  private revalidating = false;
  constructor(
    readonly gateways: Gateways,
    readonly queries: QueryClient,
    private storage: LocalStorage,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private update(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((f) => f());
  }
  private reconcileNotifications(session: Session) {
    void this.gateways.notifications
      .reconcile(session)
      .then((registered) => {
        if (
          registered &&
          this.state.session?.userId === session.userId &&
          this.state.status === "ready"
        )
          this.update({ registered: true });
      })
      .catch(() => undefined);
  }
  async start() {
    try {
      const session = await this.gateways.auth.restore();
      if (!session) {
        this.update({ status: "signedOut" });
        return;
      }
      const bootstrap = await this.gateways.bootstrap.load(session);
      this.update({
        session: {
          ...session,
          displayName: bootstrap.displayName ?? session.displayName,
        },
        bootstrap,
        status: bootstrap.status === "active" ? "ready" : bootstrap.status,
        unitId: null,
      });
      if (bootstrap.status === "active") this.reconcileNotifications(session);
    } catch (error) {
      await Promise.allSettled([
        this.gateways.auth.signOut(),
        this.storage.clear(),
      ]);
      this.update({
        status: "signedOut",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível restaurar a sessão.",
      });
    }
  }
  async login(email: string, password: string, scenario?: Scenario) {
    const op = ++this.operation;
    this.update({
      ...initial,
      status: "loading",
      generation: this.state.generation + 1,
    });
    await this.queries.cancelQueries();
    this.queries.clear();
    this.gateways.simulation.reset();
    try {
      const session = await this.gateways.auth.signIn(
        email,
        password,
        scenario,
      );
      const bootstrap = await this.gateways.bootstrap.load(session);
      if (op !== this.operation) return;
      this.update({
        session: {
          ...session,
          displayName: bootstrap.displayName ?? session.displayName,
        },
        bootstrap,
        status: bootstrap.status === "active" ? "ready" : bootstrap.status,
        unitId: null,
      });
      if (bootstrap.status === "active") this.reconcileNotifications(session);
    } catch (e) {
      if (op === this.operation)
        this.update({
          status: "signedOut",
          error: e instanceof Error ? e.message : "Não foi possível entrar.",
        });
    }
  }
  can(capability: Capability) {
    return (
      this.state.status === "ready" &&
      !this.state.locked &&
      !!this.state.bootstrap?.units
        .find((u) => u.id === this.state.unitId)
        ?.capabilities.includes(capability)
    );
  }
  canAny(capability: Capability) {
    return (
      this.state.status === "ready" &&
      !this.state.locked &&
      this.state.bootstrap?.units.some((unit) =>
        unit.capabilities.includes(capability),
      ) === true
    );
  }
  async selectUnit(id: string) {
    if (
      this.state.status !== "ready" ||
      !this.state.bootstrap?.units.some((u) => u.id === id)
    )
      throw new Error("Unidade não autorizada.");
    this.update({ unitId: null, generation: this.state.generation + 1 });
    const generation = this.state.generation;
    await this.queries.cancelQueries();
    this.queries.clear();
    if (this.state.status === "ready" && generation === this.state.generation)
      this.update({ unitId: id });
  }
  async setMode(mode: DataMode) {
    this.gateways.simulation.setMode(mode);
    this.update({ mode, generation: this.state.generation + 1 });
    await this.queries.cancelQueries();
    this.queries.clear();
  }
  lock() {
    if (this.state.biometric) this.update({ locked: true });
  }
  unlock() {
    this.update({ locked: false });
  }
  refreshSession(session: Session) {
    if (
      this.state.session?.userId === session.userId &&
      this.state.status === "ready"
    )
      this.update({
        session: { ...session, displayName: this.state.session.displayName },
      });
  }
  async revalidateAccess() {
    const session = this.state.session;
    if (!session || this.state.status !== "ready" || this.revalidating) return;
    this.revalidating = true;
    const op = this.operation;
    try {
      const bootstrap = await this.gateways.bootstrap.load(session);
      if (op !== this.operation || this.state.session !== session) return;
      const changed =
        bootstrap.accessVersion !== this.state.bootstrap?.accessVersion;
      const currentUnitAllowed = bootstrap.units.some(
        (unit) => unit.id === this.state.unitId,
      );
      if (!changed && bootstrap.status === "active" && currentUnitAllowed)
        return;
      await this.queries.cancelQueries();
      this.queries.clear();
      this.update({
        bootstrap,
        session: {
          ...session,
          displayName: bootstrap.displayName ?? session.displayName,
        },
        status: bootstrap.status === "active" ? "ready" : bootstrap.status,
        unitId:
          bootstrap.status === "active" && currentUnitAllowed
            ? this.state.unitId
            : null,
        generation: this.state.generation + 1,
        locked: false,
      });
      if (bootstrap.status === "active") this.reconcileNotifications(session);
    } catch {
      return;
    } finally {
      this.revalidating = false;
    }
  }
  setBiometric(value: boolean) {
    this.update({ biometric: value });
  }
  async register() {
    const session = this.state.session;
    const generation = this.state.generation;
    if (session) {
      await this.gateways.notifications.register(session);
      if (
        this.state.session === session &&
        this.state.generation === generation
      )
        this.update({ registered: true });
    }
  }
  async logout(expired = false) {
    ++this.operation;
    this.update({
      ...initial,
      status: expired ? "expired" : "signedOut",
      generation: this.state.generation + 1,
    });
    await this.queries.cancelQueries();
    this.queries.clear();
    const results = [];
    results.push(
      await Promise.resolve(this.gateways.notifications.unregister()).then(
        () => ({ status: "fulfilled" as const }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
    );
    results.push(
      await Promise.resolve(this.gateways.auth.signOut()).then(
        () => ({ status: "fulfilled" as const }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
    );
    results.push(
      await Promise.resolve(this.storage.clear()).then(
        () => ({ status: "fulfilled" as const }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
    );
    this.gateways.simulation.reset();
    if (results.some((r) => r.status === "rejected"))
      this.update({
        error:
          "Sessão encerrada; houve falha ao limpar um recurso local. Reinicie para tentar novamente.",
      });
  }
}
export function safeDestination(
  path: string | undefined,
): "/" | "/pending" | "/notifications" | "/assistant" {
  return path === "/pending" ||
    path === "/notifications" ||
    path === "/assistant"
    ? path
    : "/";
}
export function protectedDestination(
  state: State,
): "/login" | "/status" | "/units" | "/lock" | null {
  if (state.status === "unlinked" || state.status === "inactive")
    return "/status";
  if (state.status !== "ready") return "/login";
  if (state.locked) return "/lock";
  return state.unitId ? null : "/units";
}
