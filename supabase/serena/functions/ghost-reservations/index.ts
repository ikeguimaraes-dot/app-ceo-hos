// Deployed in Serena. Auth is checked by KPH PostgREST with the caller's JWT.
const kphUrl = "https://iqgrvptrtphvbmvrqntm.supabase.co";
const kphKey = "sb_publishable_ZeUC_rH70nELk4No1GnTNg_XBtc_GlD";
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return reply(401, { error: "authentication_required" });
  try {
    const body = await req.json();
    if (
      typeof body.unitId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.unitId) ||
      typeof body.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
    )
      return reply(400, { error: "invalid_request" });
    const permission = await fetch(
      `${kphUrl}/rest/v1/rpc/ghost_reservations_authorize_v1`,
      {
        method: "POST",
        headers: {
          authorization,
          apikey: kphKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_unit_id: body.unitId }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!permission.ok)
      return reply(
        permission.status === 401 || permission.status === 403
          ? permission.status
          : 503,
        { error: "authorization_failed" },
      );
    const scope = await permission.json();
    if (!scope.restaurantId || scope.unitId !== body.unitId)
      return reply(403, { error: "unit_not_connected" });
    const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const source = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/ghost_serena_reservations_source_v1`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serverKey}`,
          apikey: serverKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_restaurant_id: scope.restaurantId,
          p_date: body.date,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!source.ok) return reply(503, { error: "serena_unavailable" });
    return reply(200, { ...(await source.json()), unitId: scope.unitId });
  } catch {
    return reply(503, { error: "serena_unavailable" });
  }
});
