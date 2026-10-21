// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  chunks,
  constantTimeEqual,
  expoMessage,
  receiptResult,
  ticketResult,
  type ClaimedDelivery,
  type ClaimedReceipt,
  type PushResult,
} from "../_shared/push.ts";

const expoSendUrl = "https://exp.host/--/api/v2/push/send";
const expoReceiptsUrl = "https://exp.host/--/api/v2/push/getReceipts";

function secretKey() {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("supabase_secret_key_missing");
}

async function postExpo(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`expo_http_${response.status}`);
  return await response.json();
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return Response.json({ error: "method_not_allowed" }, { status: 405 });

  const workerSecret = Deno.env.get("GHOST_PUSH_WORKER_SECRET") ?? "";
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!workerSecret || !constantTimeEqual(workerSecret, supplied))
    return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claimedData, error: claimError } = await supabase.rpc(
      "ghost_internal_push_claim_v1",
      { p_limit: 100 },
    );
    if (claimError)
      throw new Error(`claim_failed:${claimError.code ?? "unknown"}`);
    const claimed = (claimedData ?? []) as ClaimedDelivery[];
    const sendResults: PushResult[] = [];

    for (const batch of chunks(claimed, 100)) {
      try {
        const response = await postExpo(expoSendUrl, batch.map(expoMessage));
        const tickets = Array.isArray(response.data)
          ? response.data
          : [response.data];
        sendResults.push(
          ...batch.map((item, index) => ticketResult(item, tickets[index])),
        );
      } catch {
        sendResults.push(
          ...batch.map((item) => ({
            deliveryId: item.deliveryId,
            status: "retry" as const,
            errorCode: "ExpoUnavailable",
          })),
        );
      }
    }
    if (sendResults.length) {
      const { error } = await supabase.rpc("ghost_internal_push_apply_v1", {
        p_results: sendResults,
      });
      if (error) throw new Error(`apply_failed:${error.code ?? "unknown"}`);
    }

    const { data: receiptData, error: receiptClaimError } = await supabase.rpc(
      "ghost_internal_push_receipts_claim_v1",
      { p_limit: 300 },
    );
    if (receiptClaimError)
      throw new Error(
        `receipt_claim_failed:${receiptClaimError.code ?? "unknown"}`,
      );
    const receiptClaims = (receiptData ?? []) as ClaimedReceipt[];
    const receiptResults: PushResult[] = [];
    for (const batch of chunks(receiptClaims, 300)) {
      try {
        const response = await postExpo(expoReceiptsUrl, {
          ids: batch.map((item) => item.ticketId),
        });
        receiptResults.push(
          ...batch.map((item) =>
            receiptResult(item, response.data?.[item.ticketId]),
          ),
        );
      } catch {
        receiptResults.push(
          ...batch.map((item) => ({
            deliveryId: item.deliveryId,
            status: "retry" as const,
            errorCode: "ReceiptUnavailable",
          })),
        );
      }
    }
    if (receiptResults.length) {
      const { error } = await supabase.rpc(
        "ghost_internal_push_receipts_apply_v1",
        {
          p_results: receiptResults,
        },
      );
      if (error)
        throw new Error(`receipt_apply_failed:${error.code ?? "unknown"}`);
    }
    const { error: cleanupError } = await supabase.rpc(
      "ghost_internal_push_cleanup_v1",
    );
    if (cleanupError)
      throw new Error(`cleanup_failed:${cleanupError.code ?? "unknown"}`);

    return Response.json({
      claimed: claimed.length,
      receipts: receiptClaims.length,
    });
  } catch (error) {
    const code =
      error instanceof Error ? error.message.split(":", 1)[0] : "worker_failed";
    return Response.json({ error: code }, { status: 500 });
  }
});
