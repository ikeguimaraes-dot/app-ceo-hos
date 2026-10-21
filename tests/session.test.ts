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
    expect(c.state.unitId).toBeNull();
  });

  it("protects deep links before login, including initial startup", async () => {
    const { controller: c } = setup();
    expect(protectedDestination(c.state)).toBe("/login");
    await c.start();
    expect(protectedDestination(c.state)).toBe("/login");
    expect(safeDestination("/notifications")).toBe("/notifications");
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
  it("requires authorized unit selection after login", async () => {
    const { controller: c } = setup();
    await enter(c);
    expect(protectedDestination(c.state)).toBe("/units");
    await expect(c.selectUnit("outside-unit")).rejects.toThrow();
    expect(c.state.unitId).toBeNull();
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
    await c.setMode("empty");
    expect((await gateways.pending.list(scope)).items).toEqual([]);
    await c.setMode("error");
    await expect(gateways.dashboard.get(scope)).rejects.toThrow(
      "Falha simulada",
    );
    await c.setMode("offline");
    await expect(gateways.dashboard.get(scope)).rejects.toThrow("offline");
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
    expect(protectedDestination(c.state)).toBe("/units");
  });
});
