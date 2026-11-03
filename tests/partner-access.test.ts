import { describe, expect, it } from "vitest";
import { createMockGateways } from "../src/data/mock-gateways";
import type { Session } from "../src/contracts/gateways";

describe("revenue-only partner access", () => {
  const session: Session = {
    userId: "demo-partner", displayName: "Sócio demo", expiresAt: Date.now() + 60000,
    scenario: "restricted",
  };
  it("returns all four houses with only revenue access and no restaurant details", async () => {
    const gateways = createMockGateways(Date.now, 0);
    const bootstrap = await gateways.bootstrap.load(session);
    expect(bootstrap.units).toHaveLength(4);
    for (const unit of bootstrap.units) {
      expect(unit.capabilities).toEqual(["dashboard.read"]);
      const dashboard = await gateways.dashboard.get({session, unitId: unit.id}, "2026-10-01");
      expect(dashboard.revenue).not.toBeNull();
      expect(dashboard.goal).not.toBeNull();
      expect(dashboard.receivedRevenue).toBeNull();
      expect(dashboard.tips).toBeNull();
      expect(dashboard.series.every(day => day.debt === null && day.cmvPercentage === null && day.shifts.every(shift => shift.tips === null))).toBe(true);
    }
  });
  it("denies payables and cash flow even with a valid revenue scope", async () => {
    const gateways = createMockGateways(Date.now, 0);
    const scope = {session, unitId: "demo-garden"};
    await expect(gateways.payables.get(scope, "open", true)).rejects.toThrow("Acesso não permitido");
    await expect(gateways.cashFlow.getWeek(scope, 0, true)).rejects.toThrow("Acesso não permitido");
  });
});
