export type Capability =
  | "dashboard.read"
  | "pending.read"
  | "maintenance.decide"
  | "punch.decide"
  | "operation.read"
  | "people.read"
  | "notifications.read"
  | "assistant.ask";
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
  periodStart: string;
  periodEnd: string;
  revenue: number | null;
  goal: number | null;
  goalProgress: number | null;
  hasData: boolean;
  provisional: boolean;
  grossRevenue: number | null;
  netRevenue: number | null;
  receivedRevenue: number | null;
  discount: number | null;
  tips: number | null;
  customers: number | null;
  averageTicket: number | null;
  projection: number | null;
  series: DashboardPoint[];
  summary: string;
};
export type ProductInvoice = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  supplier: string;
  cfop: string | null;
  status: string | null;
  totalValue: number;
  itemCount: number;
  items: ProductInvoiceItem[];
};
export type ProductInvoiceItem = {
  id: string;
  description: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  unitCost: number | null;
  totalCost: number;
  variation: number | null;
  includedInCmv: boolean | null;
};
export type ProductInvoices = {
  updatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalPurchased: number;
  invoiceCount: number;
  supplierCount: number;
  items: ProductInvoice[];
};
export type DashboardPoint = {
  date: string;
  revenue: number | null;
  goal: number | null;
  provisional: boolean;
  received: number | null;
  debt: number | null;
  discount: number | null;
  tips: number | null;
  customers: number | null;
  averageTicket: number | null;
  cmvPercentage: number | null;
  shifts: DashboardShift[];
};
export type DashboardShift = {
  id: string;
  name: "almoco" | "jantar" | "dia_inteiro";
  revenue: number;
  tips: number | null;
  customers: number | null;
  averageTicket: number | null;
  derived: boolean;
};
export type PendingItem = {
  id: string;
  kind: "maintenance" | "punch";
  title: string;
  detail: string;
  priority: "attention" | "normal";
  version: string;
  canDecide: boolean;
};
export type PendingDecision = "approve" | "reject";
export type DecidePendingInput = {
  itemId: string;
  decision: PendingDecision;
  reason: string | null;
  expectedVersion: string;
  idempotencyKey: string;
};
export type PendingDecisionResult = {
  itemId: string;
  state: "approved" | "rejected";
  version: string;
  decidedAt: string;
};
export type PayableItem = {
  id: string;
  supplier: string;
  document: string;
  dueDate: string | null;
  amount: number;
  status: "overdue" | "due_today" | "upcoming";
  daysOverdue: number;
  paymentMethod: string | null;
};
export type Payables = {
  updatedAt: string;
  asOf: string;
  openAmount: number;
  overdueAmount: number;
  dueTodayAmount: number;
  next7DaysAmount: number;
  openCount: number;
  overdueCount: number;
  items: PayableItem[];
};
export type CashFlowDay = {
  date: string;
  incoming: number;
  outgoing: number;
  balance: number;
};
export type CashFlowWeek = {
  updatedAt: string;
  weekStart: string;
  weekEnd: string;
  incoming: number;
  outgoing: number;
  balance: number;
  goesNegative: boolean;
  days: CashFlowDay[];
};
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  updatedAt: string;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  target: "/pending" | "/";
  createdAt: string;
};
export type OperationSummary = {
  updatedAt: string;
  pendingMaintenance: number;
  attentionMaintenance: number;
  oldestPendingDate: string | null;
};
export type PeopleSummary = {
  updatedAt: string;
  headcount: number;
  pendingPunchAdjustments: number;
};
export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};
export type AssistantAnswer = {
  answer: string;
  sources: string[];
  updatedAt: string;
};
export type NotificationCategory =
  "pending" | "operation" | "people" | "system";
export type NotificationPreferences = {
  categories: NotificationCategory[];
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string;
  version: number;
};
export type DailyReminder = {
  enabled: boolean;
  time: string;
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
  get(scope: Scope, month?: string): Promise<Dashboard>;
}
export interface ProductInvoicesGateway {
  get(scope: Scope, month: string): Promise<ProductInvoices>;
}
export interface PendingItemsGateway {
  list(scope: Scope, cursor?: string | null): Promise<Page<PendingItem>>;
  decide(
    scope: Scope,
    input: DecidePendingInput,
  ): Promise<PendingDecisionResult>;
}
export interface PayablesGateway {
  get(scope: Scope): Promise<Payables>;
}
export interface CashFlowGateway {
  getWeek(scope: Scope, weekOffset: number): Promise<CashFlowWeek>;
}
export interface OperationGateway {
  get(scope: Scope): Promise<OperationSummary>;
}
export interface PeopleGateway {
  get(scope: Scope): Promise<PeopleSummary>;
}
export interface AssistantGateway {
  ask(
    session: Session,
    question: string,
    history: AssistantMessage[],
    signal?: AbortSignal,
  ): Promise<AssistantAnswer>;
}
export interface NotificationGateway {
  list(scope: Scope, cursor?: string | null): Promise<Page<Notification>>;
  markRead(scope: Scope, id: string): Promise<void>;
  register(session: Session): Promise<void>;
  reconcile(session: Session): Promise<boolean>;
  unregister(): Promise<void>;
  getPreferences(session: Session): Promise<NotificationPreferences>;
  updatePreferences(
    session: Session,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences>;
  getDailyReminder(): Promise<DailyReminder>;
  setDailyReminder(reminder: DailyReminder): Promise<DailyReminder>;
}
export type DataMode = "normal" | "empty" | "error" | "offline";
export interface Gateways {
  auth: AuthGateway;
  bootstrap: BootstrapGateway;
  dashboard: DashboardGateway;
  pending: PendingItemsGateway;
  payables: PayablesGateway;
  cashFlow: CashFlowGateway;
  productInvoices: ProductInvoicesGateway;
  operation: OperationGateway;
  people: PeopleGateway;
  assistant: AssistantGateway;
  notifications: NotificationGateway;
  simulation: { setMode(mode: DataMode): void; reset(): void };
}
