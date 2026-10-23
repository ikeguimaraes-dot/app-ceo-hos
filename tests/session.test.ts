import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  Controller,
  protectedDestination,
  safeDestination,
} from "../src/state/controller";
import { createMockGateways } from "../src/data/mock-gateways";
import { pushDestination } from "../src/notifications/navigation";
function setup() {
  const storage = {
    clear: vi.fn(async () => {}),
  };
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const gateways = createMockGateways(() => 1000, 0);
  const controller = new Controller(gateways, queries, storage);
  return { controller, storage, queries, gateways };
}
async function enter(
  c: Controller,
  scenario: "active" | "restricted" | "unlinked" | "inactive" = "active",
) {
  await c.start();
  await c.login("demo@ghost.invalid", "ghost-demo", scenario);
}
describe("session and access boundaries", () => {
  it("restores an authenticated session through the gateways", async () => {
    const { controller: c, gateways } = setup();
    gateways.auth.restore = async () => ({
      userId: "restored-user",
      displayName: "Restored",
      expiresAt: 10_000,
      scenario: "active",
    });
    await c.start();
    expect(c.state.status).toBe("ready");
    expect(c.state.session?.userId).toBe("restored-user");
    expect(c.state.unitId).toBe("demo-garden");
  });

  it("reconciles an already-authorized push installation without blocking login", async () => {
    const { controller: c, gateways } = setup();
    gateways.notifications.reconcile = vi.fn(async () => true);
    await enter(c);
    await vi.waitFor(() => expect(c.state.registered).toBe(true));
    expect(gateways.notifications.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "demo-active" }),
    );
  });

  it("stores and updates the daily reminder through the notification gateway", async () => {
    const { gateways } = setup();
    expect(await gateways.notifications.getDailyReminder()).toEqual({
      enabled: false,
      time: "09:00",
    });
    await gateways.notifications.setDailyReminder({
      enabled: true,
      time: "08:30",
    });
    expect(await gateways.notifications.getDailyReminder()).toEqual({
      enabled: true,
      time: "08:30",
    });
  });

  it("protects deep links before login, including initial startup", async () => {
    const { controller: c } = setup();
    expect(protectedDestination(c.state)).toBe("/login");
    await c.start();
    expect(protectedDestination(c.state)).toBe("/login");
    expect(safeDestination("/notifications")).toBe("/notifications");
    expect(safeDestination("/assistant")).toBe("/assistant");
    expect(safeDestination("https://evil.invalid")).toBe("/");
    expect(safeDestination("//evil.invalid")).toBe("/");
  });
  it("accepts only versioned push payloads with local destinations", () => {
    expect(pushDestination({ version: 1, target: "/notifications" })).toBe(
      "/notifications",
    );
    expect(pushDestination({ version: 2, target: "/pending" })).toBe("/");
    expect(
      pushDestination({ version: 1, target: "https://evil.invalid" }),
    ).toBe("/");
  });
  it("selects the first authorized unit after login and rejects unknown units", async () => {
    const { controller: c } = setup();
    await enter(c);
    expect(c.state.unitId).toBe("demo-garden");
    expect(protectedDestination(c.state)).toBeNull();
    await expect(c.selectUnit("outside-unit")).rejects.toThrow();
    expect(c.state.unitId).toBe("demo-garden");
    await c.selectUnit("demo-garden");
    expect(protectedDestination(c.state)).toBeNull();
  });
  it.each(["unlinked", "inactive"] as const)(
    "blocks %s users from modules and selection",
    async (scenario) => {
      const { controller: c } = setup();
      await enter(c, scenario);
      expect(c.state.status).toBe(scenario);
      expect(protectedDestination(c.state)).toBe("/status");
      expect(c.can("dashboard.read")).toBe(false);
      await expect(c.selectUnit("demo-garden")).rejects.toThrow();
    },
  );
  it("honors capabilities supplied by bootstrap, also at gateway boundary", async () => {
    const { controller: c, gateways } = setup();
    await enter(c, "restricted");
    await c.selectUnit("demo-garden");
    expect(c.can("dashboard.read")).toBe(true);
    expect(c.can("pending.read")).toBe(false);
    expect(c.can("assistant.ask")).toBe(false);
    expect(c.canAny("assistant.ask")).toBe(false);
    await expect(
      gateways.pending.list({
        session: c.state.session!,
        unitId: c.state.unitId!,
      }),
    ).rejects.toThrow("Acesso não permitido");
  });
  it("removes previous-unit data and drops an in-flight response", async () => {
    const { controller: c, queries } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    queries.setQueryData(["old-data"], { sensitive: "garden" });
    let resolve!: (value: string) => void;
    const pending = queries
      .fetchQuery({
        queryKey: ["slow"],
        queryFn: () =>
          new Promise<string>((r) => {
            resolve = r;
          }),
      })
      .catch(() => undefined);
    await c.selectUnit("demo-coast");
    resolve("late garden");
    await pending;
    expect(queries.getQueryData(["old-data"])).toBeUndefined();
    expect(queries.getQueryData(["slow"])).toBeUndefined();
    expect(c.can("people.read")).toBe(false);
  });
  it("delivers month-to-date revenue and a daily chart through the dashboard gateway", async () => {
    const { controller: c, gateways } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    const dashboard = await gateways.dashboard.get({
      session: c.state.session!,
      unitId: c.state.unitId!,
    });
    expect(dashboard.periodStart).toBe("2026-10-01");
    expect(dashboard.revenue).toBe(864250);
    expect(dashboard.series).toHaveLength(14);
    expect(
      dashboard.series.every((point) => point.date.startsWith("2026-10-")),
    ).toBe(true);
    expect(dashboard.grossRevenue).toBeGreaterThan(0);
    expect(dashboard.customers).toBeGreaterThan(0);
    const previous = await gateways.dashboard.get(
      { session: c.state.session!, unitId: c.state.unitId! },
      "2026-09-01",
    );
    expect(previous.periodStart).toBe("2026-09-01");
    expect(
      previous.series.every((point) => point.date.startsWith("2026-09-")),
    ).toBe(true);
  });
  it("lists product invoices by unit and selected month", async () => {
    const { controller: c, gateways } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    const result = await gateways.productInvoices.get(
      { session: c.state.session!, unitId: c.state.unitId! },
      "2026-09-01",
    );
    expect(result.invoiceCount).toBe(3);
    expect(
      result.items.every((item) => item.issueDate.startsWith("2026-09-")),
    ).toBe(true);
    expect(result.totalPurchased).toBeCloseTo(10688.22);
    const productMatch = await gateways.productInvoices.get(
      { session: c.state.session!, unitId: c.state.unitId! },
      "2026-09-01",
      "material de apoio",
    );
    expect(productMatch.items).toHaveLength(3);
  });
  it("expires session and removes business cache, identity and local marker", async () => {
    const { controller: c, storage, queries } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    queries.setQueryData(["business"], "private");
    await c.logout(true);
    expect(c.state.status).toBe("expired");
    expect(c.state.session).toBeNull();
    expect(protectedDestination(c.state)).toBe("/login");
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.clear).toHaveBeenCalledTimes(1);
  });
  it("logout resets device registration, local lock, scenarios and cache", async () => {
    const { controller: c, queries, storage } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    await c.register();
    c.setBiometric(true);
    c.lock();
    expect(protectedDestination(c.state)).toBe("/lock");
    expect(c.can("dashboard.read")).toBe(false);
    await c.setMode("offline");
    queries.setQueryData(["demo"], "value");
    await c.logout();
    expect(c.state).toMatchObject({
      status: "signedOut",
      unitId: null,
      bootstrap: null,
      registered: false,
      biometric: false,
      locked: false,
      mode: "normal",
    });
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.clear).toHaveBeenCalled();
  });
  it("clears local data even if unregister fails", async () => {
    const { controller: c, gateways, storage } = setup();
    await enter(c);
    gateways.notifications.unregister = async () => {
      throw new Error("failure");
    };
    await c.logout();
    expect(c.state.session).toBeNull();
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(c.state.error).toContain("falha");
  });
  it("does not restore a login response after logout", async () => {
    const { controller: c } = setup();
    await c.start();
    const login = c.login("demo@ghost.invalid", "ghost-demo", "active");
    await c.logout();
    await login;
    expect(c.state.status).toBe("signedOut");
    expect(c.state.session).toBeNull();
  });
  it("mocks are deterministic and support empty, error and offline modes", async () => {
    const { controller: c, gateways } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    const scope = { session: c.state.session!, unitId: "demo-garden" };
    expect(await gateways.dashboard.get(scope)).toEqual(
      await gateways.dashboard.get(scope),
    );
    const todayPayables = await gateways.payables.get(scope);
    expect(todayPayables.openAmount).toBe(12680.5);
    expect(todayPayables.items).toHaveLength(1);
    expect(todayPayables.items[0]?.status).toBe("due_today");
    expect(todayPayables.overdueAmount).toBe(9840.2);
    expect(todayPayables.next7DaysAmount).toBe(18750);
    const cashFlow = await gateways.cashFlow.getWeek(scope, 0);
    expect(cashFlow.weekStart).toBe("2026-10-19");
    expect(cashFlow.weekEnd).toBe("2026-10-25");
    expect(cashFlow.incoming).toBeCloseTo(
      cashFlow.actualIncoming + cashFlow.projectedIncoming,
    );
    expect(cashFlow.actualIncoming).toBeGreaterThan(0);
    expect(cashFlow.projectedIncoming).toBeGreaterThan(0);
    expect(cashFlow.historyWeeks).toBe(5);
    expect(cashFlow.outgoing).toBe(356498.28);
    expect(cashFlow.days).toHaveLength(7);
    expect(cashFlow.days.slice(0, 3).every((day) => !day.projected)).toBe(true);
    expect(cashFlow.days.slice(3).every((day) => day.projected)).toBe(true);
    expect(cashFlow.days.at(-1)?.balance).toBe(cashFlow.balance);
    await c.setMode("empty");
    expect((await gateways.pending.list(scope)).items).toEqual([]);
    expect((await gateways.payables.get(scope)).items).toEqual([]);
    expect((await gateways.cashFlow.getWeek(scope, 0)).balance).toBe(0);
    await c.setMode("error");
    await expect(gateways.dashboard.get(scope)).rejects.toThrow(
      "Falha simulada",
    );
    await c.setMode("offline");
    await expect(gateways.dashboard.get(scope)).rejects.toThrow("offline");
  });
  it("answers through the assistant gateway only when bootstrap grants access", async () => {
    const { controller: c, gateways } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    expect(c.canAny("assistant.ask")).toBe(true);
    const answer = await gateways.assistant.ask(
      c.state.session!,
      "Como estão as empresas?",
      [],
      "deepseek/deepseek-v4.1-flash",
    );
    expect(answer.answer).toContain("4 casas");
    expect(answer.answer).toContain("2.482.380,00");
    expect(answer.sources).toEqual(["Dashboard de todas as casas", "Operação"]);

    const restricted = setup();
    await enter(restricted.controller, "restricted");
    await restricted.controller.selectUnit("demo-garden");
    await expect(
      restricted.gateways.assistant.ask(
        restricted.controller.state.session!,
        "Como estão as empresas?",
        [],
        "deepseek/deepseek-v4.1-flash",
      ),
    ).rejects.toThrow("Acesso não permitido");
  });
  it("decides a pending item once and replays the same idempotent result", async () => {
    const { controller: c, gateways } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    const scope = { session: c.state.session!, unitId: "demo-garden" };
    const input = {
      itemId: "demo-review",
      decision: "approve" as const,
      reason: null,
      expectedVersion: "demo-review-v1",
      idempotencyKey: "test-idempotency-0001",
    };
    const first = await gateways.pending.decide(scope, input);
    expect(await gateways.pending.decide(scope, input)).toEqual(first);
    expect((await gateways.pending.list(scope)).items).not.toContainEqual(
      expect.objectContaining({ id: "demo-review" }),
    );
  });
  it("rejects stale versions, reused keys and missing decision capability", async () => {
    const { controller: c, gateways } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    const scope = { session: c.state.session!, unitId: "demo-garden" };
    await expect(
      gateways.pending.decide(scope, {
        itemId: "demo-document",
        decision: "reject",
        reason: "Registro divergente",
        expectedVersion: "stale",
        idempotencyKey: "test-idempotency-0002",
      }),
    ).rejects.toThrow("mudou");
    const original = {
      itemId: "demo-document",
      decision: "reject" as const,
      reason: "Registro divergente",
      expectedVersion: "demo-document-v1",
      idempotencyKey: "test-idempotency-0003",
    };
    await gateways.pending.decide(scope, original);
    await expect(
      gateways.pending.decide(scope, { ...original, reason: "Outro motivo" }),
    ).rejects.toThrow("idempotência");

    const restricted = setup();
    await enter(restricted.controller, "restricted");
    await restricted.controller.selectUnit("demo-garden");
    await expect(
      restricted.gateways.pending.decide(
        {
          session: restricted.controller.state.session!,
          unitId: "demo-garden",
        },
        {
          itemId: "demo-review",
          decision: "approve",
          reason: null,
          expectedVersion: "demo-review-v1",
          idempotencyKey: "test-idempotency-0004",
        },
      ),
    ).rejects.toThrow("Acesso não permitido");
  });
  it("revokes removed capabilities and clears cached data on access change", async () => {
    const { controller: c, gateways, queries } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    queries.setQueryData(["private"], "cached");
    const original = gateways.bootstrap.load;
    gateways.bootstrap.load = async (session) => ({
      ...(await original({ ...session, scenario: "restricted" })),
      accessVersion: "revoked-v2",
    });
    await c.revalidateAccess();
    expect(c.can("pending.read")).toBe(false);
    expect(c.can("dashboard.read")).toBe(true);
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
  });
  it("removes a selected unit immediately when the refreshed scope no longer contains it", async () => {
    const { controller: c, gateways } = setup();
    await enter(c);
    await c.selectUnit("demo-garden");
    gateways.bootstrap.load = async () => ({
      status: "active",
      accessVersion: "unit-removed-v2",
      units: [],
    });
    await c.revalidateAccess();
    expect(c.state.unitId).toBeNull();
    expect(protectedDestination(c.state)).toBe("/status");
  });
});
