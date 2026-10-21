// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  chunks,
  constantTimeEqual,
  expoMessage,
  operationLog,
  requestId,
  receiptResult,
  stableErrorCode,
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
  const startedAt = performance.now();
  const id = requestId(request.headers.get("x-request-id"), () =>
    crypto.randomUUID(),
  );
  const response = (body: Record<string, unknown>, status = 200) =>
    Response.json(
      { ...body, requestId: id },
      {
        status,
        headers: { "x-request-id": id },
      },
    );
  if (request.method !== "POST")
    return response({ error: "method_not_allowed" }, 405);

  const workerSecret = Deno.env.get("GHOST_PUSH_WORKER_SECRET") ?? "";
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!workerSecret || !constantTimeEqual(workerSecret, supplied))
    return response({ error: "unauthorized" }, 401);

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (error) {
    const code = stableErrorCode(error);
    console.error(
      JSON.stringify(
        operationLog(id, "error", code, performance.now() - startedAt),
      ),
    );
    return response({ error: code }, 500);
  }
  const record = async (
    outcome: "success" | "error",
    code: string,
    claimed: number,
    receipts: number,
  ) => {
    const log = operationLog(id, outcome, code, performance.now() - startedAt);
    console.log(JSON.stringify(log));
    try {
      const { error } = await supabase.rpc("ghost_internal_operation_log_v1", {
        p_request_id: log.requestId,
        p_operation: log.operation,
        p_outcome: log.outcome,
        p_code: log.code,
        p_duration_ms: log.durationMs,
        p_claimed_count: claimed,
        p_receipt_count: receipts,
      });
      if (!error) return;
    } catch {
      // The worker response must not depend on telemetry availability.
    }
    console.error(JSON.stringify({ ...log, code: "operation_log_failed" }));
  };
  try {
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

    await record("success", "ok", claimed.length, receiptClaims.length);
    return response({
      claimed: claimed.length,
      receipts: receiptClaims.length,
    });
  } catch (error) {
    const code = stableErrorCode(error);
    await record("error", code, 0, 0);
    return response({ error: code }, 500);
  }
});
