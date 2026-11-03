// Only the source project's runtime uses an administrative identity.
// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { eventsHandler } from "./handler.ts";
const kphUrl = "https://iqgrvptrtphvbmvrqntm.supabase.co";
const kphKey = "sb_publishable_ZeUC_rH70nELk4No1GnTNg_XBtc_GlD";
Deno.serve(
  eventsHandler({
    async authorize(authorization, unitId) {
      const response = await fetch(
        `${kphUrl}/rest/v1/rpc/ghost_events_authorize_v1`,
        {
          method: "POST",
          headers: {
            authorization,
            apikey: kphKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_unit_id: unitId }),
          signal: AbortSignal.timeout(5000),
        },
      );
      return {
        status: response.status,
        unitId: response.ok ? (await response.json()).unitId : undefined,
      };
    },
    async source(body) {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
      const key = keys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!key) throw new Error("source_not_configured");
      const client = createClient(Deno.env.get("SUPABASE_URL")!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.rpc(
        "ghost_events_revenue_source_v1",
        {
          p_unit_id: body.unitId,
          p_start: body.start,
          p_end: body.end,
        },
      );
      if (error) throw new Error("events_unavailable");
      return data;
    },
  }),
);
