export type Capability =
  | "dashboard.read"
  | "pending.read"
  | "operation.read"
  | "people.read"
  | "notifications.read";
export type Scenario = "active" | "unlinked" | "inactive" | "restricted";
export type Session = {
  userId: string;
  displayName: string;
  expiresAt: number;
  scenario?: Scenario;
};
export type Unit = {
  id: string;
  name: string;
  group: string;
  brand: string;
  capabilities: Capability[];
};
export type Bootstrap = {
  status: "active" | "unlinked" | "inactive";
  units: Unit[];
  accessVersion?: string;
  displayName?: string;
};
export type Scope = { session: Session; unitId: string; signal?: AbortSignal };
export type Dashboard = {
  updatedAt: string;
  revenue: number | null;
  goal: number | null;
  goalProgress: number | null;
  hasData: boolean;
  summary: string;
};
export type PendingItem = {
  id: string;
  title: string;
  detail: string;
  priority: "attention" | "normal";
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  target: "/pending" | "/";
};
export type NotificationCategory = "pending" | "operation" | "people" | "system";
export type NotificationPreferences = {
  categories: NotificationCategory[];
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string;
  version: number;
};
export interface AuthGateway {
  restore(): Promise<Session | null>;
  signIn(
    email: string,
    password: string,
    scenario?: Scenario,
  ): Promise<Session>;
  recover(email: string): Promise<void>;
  completeRecovery(url: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  onSessionChange?(listener: (session: Session | null) => void): () => void;
  setAppActive?(active: boolean): void;
}
export interface BootstrapGateway {
  load(session: Session): Promise<Bootstrap>;
}
export interface DashboardGateway {
  get(scope: Scope): Promise<Dashboard>;
}
export interface PendingItemsGateway {
  list(scope: Scope): Promise<PendingItem[]>;
}
export interface NotificationGateway {
  list(scope: Scope): Promise<Notification[]>;
  markRead(scope: Scope, id: string): Promise<void>;
  register(session: Session): Promise<void>;
  unregister(): Promise<void>;
  getPreferences(session: Session): Promise<NotificationPreferences>;
  updatePreferences(
    session: Session,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences>;
}
export type DataMode = "normal" | "empty" | "error" | "offline";
export interface Gateways {
  auth: AuthGateway;
  bootstrap: BootstrapGateway;
  dashboard: DashboardGateway;
  pending: PendingItemsGateway;
  notifications: NotificationGateway;
  simulation: { setMode(mode: DataMode): void; reset(): void };
}
