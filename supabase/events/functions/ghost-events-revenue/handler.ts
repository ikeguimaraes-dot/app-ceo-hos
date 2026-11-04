type Body = { unitId: string; start: string; end: string };
export type EventsDependencies = {
  authorize: (
    authorization: string,
    unitId: string,
  ) => Promise<{ status: number; unitId?: string }>;
  source: (body: Body) => Promise<unknown>;
};
const reply = (status: number, body: unknown) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export function eventsHandler(deps: EventsDependencies) {
  return async (req: Request) => {
    if (req.method !== "POST")
      return reply(405, { error: "method_not_allowed" });
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer "))
      return reply(401, { error: "authentication_required" });
    let body: Body;
    try {
      const input = await req.json();
      if (
        typeof input.unitId !== "string" ||
        !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.unitId) ||
        typeof input.start !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.start) ||
        typeof input.end !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.end) ||
        !Number.isFinite(Date.parse(`${input.start}T00:00:00Z`)) ||
        !Number.isFinite(Date.parse(`${input.end}T00:00:00Z`)) ||
        new Date(`${input.start}T00:00:00Z`).toISOString().slice(0, 10) !==
          input.start ||
        new Date(`${input.end}T00:00:00Z`).toISOString().slice(0, 10) !==
          input.end ||
        input.start < "2000-01-01" ||
        (Date.parse(input.end) - Date.parse(input.start)) / 86400000 > 122 ||
        input.end < input.start
      )
        return reply(400, { error: "invalid_request" });
      body = { unitId: input.unitId, start: input.start, end: input.end };
    } catch {
      return reply(400, { error: "invalid_request" });
    }
    try {
      // The KPH PostgREST gateway validates the JWT; its RPC rechecks active user,
      // authorized unit and dashboard capability before any privileged source read.
      const permission = await deps.authorize(authorization, body.unitId);
      if (permission.status !== 200 || permission.unitId !== body.unitId)
        return reply(
          permission.status === 401
            ? 401
            : permission.status === 403 || permission.status === 200
              ? 403
              : 503,
          { error: "authorization_failed" },
        );
      const days = await deps.source(body);
      if (!Array.isArray(days)) throw new Error("invalid_source");
      return reply(200, { ...body, days });
    } catch {
      return reply(503, { error: "events_unavailable" });
    }
  };
}
