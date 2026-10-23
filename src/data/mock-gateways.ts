import type {
  Gateways,
  Scope,
  Capability,
  Session,
  DataMode,
  NotificationPreferences,
  DailyReminder,
  DecidePendingInput,
  PendingDecisionResult,
  PayableFilter,
  Payables,
  CashFlowWeek,
  PayableItem,
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
  let dailyReminder: DailyReminder = { enabled: false, time: "09:00" };
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
      async get(scope, month) {
        await check(scope, "dashboard.read");
        const base =
          demo.dashboards[scope.unitId as keyof typeof demo.dashboards];
        const requested = month?.slice(0, 7) ?? base.periodStart.slice(0, 7);
        const scale = requested === base.periodStart.slice(0, 7) ? 1 : 0.86;
        const moveDate = (date: string) => `${requested}-${date.slice(8, 10)}`;
        return mode === "empty"
          ? {
              updatedAt: "2026-10-20T12:00:00Z",
              periodStart: "2026-10-01",
              periodEnd: "2026-10-20",
              revenue: null,
              goal: null,
              goalProgress: null,
              hasData: false,
              provisional: false,
              grossRevenue: null,
              netRevenue: null,
              receivedRevenue: null,
              discount: null,
              tips: null,
              customers: null,
              averageTicket: null,
              projection: null,
              portfolioSnapshot: null,
              series: [],
              summary: "Nenhum fechamento neste período simulado.",
            }
          : {
              ...base,
              periodStart: `${requested}-01`,
              periodEnd: moveDate(base.periodEnd),
              revenue:
                base.revenue == null ? null : Math.round(base.revenue * scale),
              goal: base.goal == null ? null : Math.round(base.goal * scale),
              grossRevenue: Math.round(base.grossRevenue * scale),
              netRevenue: Math.round(base.netRevenue * scale),
              receivedRevenue: Math.round(base.receivedRevenue * scale),
              discount: Math.round(base.discount * scale),
              tips: Math.round(base.tips * scale),
              projection: Math.round(base.projection * scale),
              portfolioSnapshot: {
                asOf: moveDate(base.periodEnd),
                monthGoal: Math.round((base.goal / 20) * 31 * scale),
                accumulatedGoal: Math.round(base.goal * scale),
                accumulatedRevenue: Math.round(base.revenue * scale),
                difference: Math.round((base.revenue - base.goal) * scale),
                deviation:
                  base.goal === 0 ? null : (base.revenue - base.goal) / base.goal,
              },
              series: base.series.map((point) => ({
                ...point,
                date: moveDate(point.date),
                revenue:
                  point.revenue == null
                    ? null
                    : Math.round(point.revenue * scale),
                goal:
                  point.goal == null ? null : Math.round(point.goal * scale),
                received:
                  point.received == null
                    ? null
                    : Math.round(point.received * scale),
                debt:
                  point.debt == null ? null : Math.round(point.debt * scale),
                discount:
                  point.discount == null
                    ? null
                    : Math.round(point.discount * scale),
                tips:
                  point.tips == null ? null : Math.round(point.tips * scale),
                shifts: point.shifts.map((shift) => ({
                  ...shift,
                  revenue: Math.round(shift.revenue * scale),
                  tips:
                    shift.tips == null ? null : Math.round(shift.tips * scale),
                })),
              })),
            };
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
    payables: {
      async get(
        scope,
        filter: PayableFilter = "open",
        allUnits = false,
        period,
      ) {
        await check(scope, "dashboard.read");
        const unitIds = allUnits
          ? demo.units.map((unit) => unit.id)
          : [scope.unitId];
        const sources = unitIds
          .map((id) => demo.payables[id as keyof typeof demo.payables])
          .filter(Boolean);
        const todayDate = new Date(now());
        const formatDate = (value: Date) =>
          `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
        const today = formatDate(todayDate);
        const shiftDate = (value: string) => {
          const anchor = new Date("2026-10-22T12:00:00");
          const sourceDate = new Date(`${value}T12:00:00`);
          const shifted = new Date(todayDate);
          shifted.setDate(
            todayDate.getDate() +
              Math.round(
                (sourceDate.getTime() - anchor.getTime()) / 86_400_000,
              ),
          );
          return formatDate(shifted);
        };
        const normalized: PayableItem[] = sources.flatMap(
          (source, sourceIndex) =>
            source.items.map((item): PayableItem => {
              const dueDate = shiftDate(item.dueDate);
              return {
                ...item,
                dueDate,
                status:
                  dueDate < today
                    ? "overdue"
                    : dueDate === today
                      ? "due_today"
                      : "upcoming",
                daysOverdue:
                  dueDate < today
                    ? Math.round(
                        (new Date(`${today}T12:00:00`).getTime() -
                          new Date(`${dueDate}T12:00:00`).getTime()) /
                          86_400_000,
                      )
                    : 0,
                unitId: unitIds[sourceIndex]!,
                unitName:
                  demo.units.find((unit) => unit.id === unitIds[sourceIndex]!)
                    ?.name ?? "Unidade",
                paidDate: null,
              };
            }),
        );
        const paid: PayableItem[] = sources.map(
          (source, sourceIndex): PayableItem => {
            const item = source.items[0]! as PayableItem;
            return {
              ...item,
              id: `${item.id}-paid`,
              unitId: unitIds[sourceIndex]!,
              unitName:
                demo.units.find((unit) => unit.id === unitIds[sourceIndex]!)
                  ?.name ?? "Unidade",
              paidDate: shiftDate("2026-10-20"),
              dueDate: shiftDate("2026-10-18"),
              status: "paid" as const,
              daysOverdue: 0,
            };
          },
        );
        const start = period?.start ?? today;
        const end = period?.end ?? start;
        const inPeriod = (item: PayableItem) =>
          !!item.dueDate && item.dueDate >= start && item.dueDate <= end;
        const candidates =
          filter === "paid"
            ? paid
            : normalized.filter(
                (item) =>
                  filter === "open" ||
                  (filter === "overdue"
                    ? item.status === "overdue"
                    : item.status !== "overdue"),
              );
        const items = candidates.filter(inPeriod);
        const openInPeriod = normalized.filter(inPeriod);
        const paidInPeriod = paid.filter(inPeriod);
        const sevenDays = new Date(todayDate);
        sevenDays.setDate(todayDate.getDate() + 7);
        const nextWeek = formatDate(sevenDays);
        const result: Payables = {
          updatedAt: sources[0]?.updatedAt ?? "2026-10-22T15:00:00Z",
          asOf: today,
          scope: allUnits ? "all" : "unit",
          openAmount: openInPeriod.reduce(
            (total, item) => total + item.amount,
            0,
          ),
          overdueAmount: normalized
            .filter((item) => item.status === "overdue")
            .reduce((total, item) => total + item.amount, 0),
          dueTodayAmount: normalized
            .filter((item) => item.status === "due_today")
            .reduce((total, item) => total + item.amount, 0),
          next7DaysAmount: normalized
            .filter(
              (item) => item.dueDate! > today && item.dueDate! <= nextWeek,
            )
            .reduce((total, item) => total + item.amount, 0),
          paidAmount: paidInPeriod.reduce(
            (total, item) => total + item.amount,
            0,
          ),
          openCount: openInPeriod.length,
          overdueCount: normalized.filter((item) => item.status === "overdue")
            .length,
          paidCount: paidInPeriod.length,
          items,
        };
        if (mode === "empty")
          return {
            ...result,
            openAmount: 0,
            overdueAmount: 0,
            dueTodayAmount: 0,
            next7DaysAmount: 0,
            paidAmount: 0,
            openCount: 0,
            overdueCount: 0,
            paidCount: 0,
            items: [],
          };
        return result;
      },
    },
    cashFlow: {
      async getWeek(scope, weekOffset, allUnits = false) {
        await check(scope, "dashboard.read");
        const unitIds = allUnits
          ? demo.units.map((unit) => unit.id)
          : [scope.unitId];
        const sources = unitIds
          .map((id) => demo.cashFlow[id as keyof typeof demo.cashFlow])
          .filter(Boolean);
        if (!sources.length)
          throw new Error("Unidade sem fluxo de caixa simulado.");
        const factors = [0.22, 0.25, 0.2, 0.18, 0.2, 0.4, 0.35];
        const dates = [
          "2026-10-19",
          "2026-10-20",
          "2026-10-21",
          "2026-10-22",
          "2026-10-23",
          "2026-10-24",
          "2026-10-25",
        ];
        const rawDays = dates.map((date, index) => ({
          date,
          actualIncoming:
            index < 3
              ? sources.reduce(
                  (total, source) => total + source.incoming * factors[index]!,
                  0,
                )
              : 0,
          projectedIncoming:
            index >= 3
              ? sources.reduce(
                  (total, source) => total + source.incoming * factors[index]!,
                  0,
                )
              : 0,
          projected: index >= 3,
          outgoing: sources.reduce(
            (total, source) => total + (source.days[index]?.outgoing ?? 0),
            0,
          ),
        }));
        let running = 0;
        const currentDays = rawDays.map((day) => {
          const incoming = day.actualIncoming + day.projectedIncoming;
          running += incoming - day.outgoing;
          return { ...day, incoming, balance: running };
        });
        const current: CashFlowWeek = {
          updatedAt: "2026-10-22T15:00:00Z",
          weekStart: dates[0]!,
          weekEnd: dates[6]!,
          scope: allUnits ? "all" : "unit",
          historyWeeks: 5,
          actualIncoming: currentDays.reduce(
            (total, day) => total + day.actualIncoming,
            0,
          ),
          projectedIncoming: currentDays.reduce(
            (total, day) => total + day.projectedIncoming,
            0,
          ),
          incoming: currentDays.reduce((total, day) => total + day.incoming, 0),
          outgoing: currentDays.reduce((total, day) => total + day.outgoing, 0),
          balance: running,
          goesNegative: currentDays.some((day) => day.balance < 0),
          days: currentDays,
        };
        if (mode === "empty")
          return {
            ...current,
            actualIncoming: 0,
            projectedIncoming: 0,
            incoming: 0,
            outgoing: 0,
            balance: 0,
            goesNegative: false,
            days: current.days.map((day) => ({
              ...day,
              actualIncoming: 0,
              projectedIncoming: 0,
              incoming: 0,
              outgoing: 0,
              balance: 0,
            })),
          };
        if (weekOffset === 0) return current;
        const shift = weekOffset * 7 * 86400000;
        const move = (date: string) =>
          new Date(new Date(`${date}T12:00:00Z`).getTime() + shift)
            .toISOString()
            .slice(0, 10);
        running = 0;
        const futureDays = current.days.map((day) => {
          const incoming = day.incoming;
          running += incoming - day.outgoing;
          return {
            ...day,
            date: move(day.date),
            actualIncoming: 0,
            projectedIncoming: incoming,
            projected: true,
            balance: running,
          };
        });
        return {
          ...current,
          weekStart: move(current.weekStart),
          weekEnd: move(current.weekEnd),
          actualIncoming: 0,
          projectedIncoming: current.incoming,
          balance: running,
          goesNegative: futureDays.some((day) => day.balance < 0),
          days: futureDays,
        };
      },
    },
    productInvoices: {
      async get(scope, month, search) {
        await check(scope, "operation.read");
        const source =
          demo.productInvoices[
            scope.unitId as keyof typeof demo.productInvoices
          ] ?? [];
        const allItems =
          mode === "empty"
            ? []
            : source.map((item) => ({
                ...item,
                issueDate: `${month.slice(0, 7)}-${item.issueDate.slice(8, 10)}`,
                items: Array.from(
                  { length: Math.min(item.itemCount, 4) },
                  (_, index) => ({
                    id: `${item.id}-item-${index}`,
                    description: [
                      "Produto fresco",
                      "Bebida",
                      "Insumo de cozinha",
                      "Material de apoio",
                    ][index]!,
                    category: index === 3 ? "Material" : "Alimentos e bebidas",
                    quantity: index + 1,
                    unit: "UN",
                    unitCost: item.totalValue / item.itemCount,
                    totalCost: item.totalValue / Math.min(item.itemCount, 4),
                    variation: index === 0 ? 0.032 : null,
                    includedInCmv: index !== 3,
                  }),
                ),
              }));
        const needle = search?.trim().toLocaleLowerCase("pt-BR");
        const items = needle
          ? allItems.filter((item) =>
              [
                item.invoiceNumber,
                item.supplier,
                item.cfop ?? "",
                ...item.items.flatMap((line) => [
                  line.description,
                  line.category ?? "",
                ]),
              ]
                .join(" ")
                .toLocaleLowerCase("pt-BR")
                .includes(needle),
            )
          : allItems;
        return {
          updatedAt: "2026-10-22T15:00:00Z",
          periodStart: `${month.slice(0, 7)}-01`,
          periodEnd: `${month.slice(0, 7)}-31`,
          totalPurchased: items.reduce((sum, item) => sum + item.totalValue, 0),
          invoiceCount: items.length,
          supplierCount: new Set(items.map((item) => item.supplier)).size,
          items,
        };
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
      async ask(
        session,
        question,
        _history,
        modelId,
        conversationState,
        signal,
      ) {
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
          modelId,
          requestId: "00000000-0000-4000-8000-000000000001",
          conversationState: conversationState ?? {
            dataset: "financeiro",
            from: "2026-10-01",
            to: "2026-10-20",
            grain: "day" as const,
          },
        };
      },
      async feedback(session) {
        if (session.expiresAt <= now()) throw new Error("Sessão expirada.");
        await wait();
      },
      async quality(session, days = 7) {
        if (session.expiresAt <= now()) throw new Error("Sessão expirada.");
        await wait();
        return {
          days,
          totalRequests: 24,
          successfulRequests: 22,
          failedRequests: 2,
          deterministicRequests: 9,
          helpful: 10,
          unhelpful: 2,
          feedbackCount: 12,
          averageLatencyMs: 1840,
          successRate: 91.7,
          helpfulRate: 83.3,
          byModel: [
            {
              modelId: "deepseek/deepseek-v4.1-flash",
              requests: 24,
              successfulRequests: 22,
              failedRequests: 2,
              helpful: 10,
              feedbackCount: 12,
              helpfulRate: 83.3,
              averageLatencyMs: 1840,
            },
          ],
          byDataset: [
            { dataset: "financeiro", requests: 12 },
            { dataset: "compras_itens", requests: 8 },
          ],
          failures: [{ code: "model_unavailable", occurrences: 2 }],
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
      async getDailyReminder() {
        await wait();
        return { ...dailyReminder };
      },
      async setDailyReminder(next) {
        await wait();
        dailyReminder = { ...next };
        return { ...dailyReminder };
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
