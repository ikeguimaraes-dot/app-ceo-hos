import { describe, expect, it, vi } from "vitest";
import { eventsHandler } from "../supabase/events/functions/ghost-events-revenue/handler";
const unitId = "674eac8c-5a38-4a42-aa60-0a666387909b";
const body = { unitId, start: "2026-10-01", end: "2026-10-31" };
function setup(status = 200, authorizedUnit = unitId) {
  const authorize = vi.fn(async () => ({ status, unitId: authorizedUnit }));
  const source = vi.fn(async () => [{ date: "2026-10-27", revenue: 26200 }]);
  const request = (input: unknown = body, token = true) =>
    new Request("https://example.invalid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { authorization: "Bearer invalid-example" } : {}),
      },
      body: JSON.stringify(input),
    });
  return {
    authorize,
    source,
    request,
    handle: eventsHandler({ authorize, source }),
  };
}
describe("Events revenue gateway", () => {
  it("rejects anonymous requests before consulting any source", async () => {
    const t = setup();
    expect((await t.handle(t.request(body, false))).status).toBe(401);
    expect(t.authorize).not.toHaveBeenCalled();
    expect(t.source).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])(
    "does not read events when KPH authorization returns %i",
    async (status) => {
      const t = setup(status);
      expect((await t.handle(t.request())).status).toBe(status);
      expect(t.source).not.toHaveBeenCalled();
    },
  );
  it("rejects a mismatched authorized house", async () => {
    const t = setup(200, "970db6d9-9ff9-4284-9f76-9fbeb494ea04");
    expect((await t.handle(t.request())).status).toBe(403);
    expect(t.source).not.toHaveBeenCalled();
  });
  it.each([
    { ...body, end: "2027-03-01" },
    { ...body, start: "2026-02-30" },
    { ...body, unitId: "other" },
  ])("rejects an invalid scope or period", async (invalid) => {
    const t = setup();
    expect((await t.handle(t.request(invalid))).status).toBe(400);
    expect(t.source).not.toHaveBeenCalled();
  });
  it("supports a bounded history across months with one authorized source call", async () => {
    const t = setup();
    const range = { ...body, start: "2026-08-10", end: "2026-11-01" };
    expect((await t.handle(t.request(range))).status).toBe(200);
    expect(t.source).toHaveBeenCalledExactlyOnceWith(range);
  });
  it("returns only scoped daily aggregates with no cache", async () => {
    const t = setup();
    const response = await t.handle(t.request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ...body,
      days: [{ date: "2026-10-27", revenue: 26200 }],
    });
    expect(t.source).toHaveBeenCalledWith(body);
  });
  it("reports a source outage instead of manufacturing zero events", async () => {
    const t = setup();
    t.source.mockRejectedValue(new Error("unavailable"));
    const response = await t.handle(t.request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "events_unavailable" });
  });
});
