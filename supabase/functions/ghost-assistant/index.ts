// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  assistantModel,
  parseAssistantInput,
  shouldRetryModelRequest,
  systemPrompt,
  normalizeAssistantSources,
} from "../_shared/assistant.ts";
import { runInvestigation } from "../_shared/assistant-agent.ts";

const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: cors });
}

function errorCode(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (/assistant_rate_limited|PT429/i.test(text)) return "rate_limited";
  if (/unit_capability_denied|42501/i.test(text)) return "forbidden";
  if (/invalid_/i.test(text)) return "invalid_request";
  if (/openrouter_/i.test(text)) return "model_unavailable";
  const technical =
    /^(assistant_(?:unverified_numbers|investigation_timeout|investigation_limit|tool_budget_exceeded))$/.exec(
      text,
    )?.[1];
  if (technical) return technical;
  return "assistant_failed";
}

function providerStatus(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /openrouter_http_(\d{3})/i.exec(text)?.[1] ?? null;
}

function retryAfterMs(response: Response, attempt: number) {
  const seconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(seconds) && seconds > 0)
    return Math.min(seconds * 1_000, 2_000);
  return 450 * (attempt + 1);
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function anonymousUserId(userId: string) {
  const bytes = new TextEncoder().encode(`ghost:${userId}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest]
    .slice(0, 16)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return reply({ error: "method_not_allowed" }, 405);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 131_072) return reply({ error: "request_too_large" }, 413);

  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  let model = assistantModel;
  let supabase: ReturnType<typeof createClient> | null = null;
  let began = false;
  let toolCallCount = 0;
  let validationAttempts = 0;
  const queriedDatasets = new Set<string>();
  const finish = async (
    outcome: "success" | "error",
    code: string,
    promptTokens = 0,
    completionTokens = 0,
  ) => {
    if (!began || !supabase) return;
    await supabase.rpc("ghost_assistant_finish_v2", {
      p_request_id: requestId,
      p_outcome: outcome,
      p_code: code,
      p_model: model,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
      p_datasets: [...queriedDatasets],
      p_tool_call_count: toolCallCount,
      p_validation_attempts: validationAttempts,
      p_latency_ms: Math.min(
        120_000,
        Math.max(0, Math.round(performance.now() - startedAt)),
      ),
    });
  };

  try {
    if (!/^Bearer\s+\S+$/i.test(authorization))
      return reply({ error: "authentication_required" }, 401);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 131_072)
      return reply({ error: "request_too_large" }, 413);
    const input = parseAssistantInput(JSON.parse(raw));
    model = input.modelId;
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("openrouter_key_missing");
    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data: identity, error: identityError } =
      await supabase.auth.getUser();
    if (identityError || !identity.user)
      return reply({ error: "authentication_required" }, 401);

    const { data: bootstrap, error: bootstrapError } =
      await supabase.rpc("ghost_bootstrap_v1");
    if (bootstrapError) throw bootstrapError;
    const units = (bootstrap?.units ?? []).filter(
      (candidate: { capabilities?: string[] }) =>
        candidate.capabilities?.includes("assistant.ask"),
    ) as {
      id: string;
      name: string;
      brand: string;
      group: string;
      capabilities: string[];
    }[];
    if (!units.length) throw new Error("unit_capability_denied");
    if (units.length > 20) throw new Error("portfolio_too_large");

    const { error: beginError } = await supabase.rpc(
      "ghost_assistant_begin_v1",
      { p_unit_id: units[0].id, p_request_id: requestId },
    );
    if (beginError) throw beginError;
    began = true;

    const { data: catalog, error: catalogError } = await supabase.rpc(
      "ghost_assistant_catalog_v3",
    );
    if (catalogError) throw catalogError;
    const catalogRecord =
      catalog && typeof catalog === "object"
        ? (catalog as Record<string, unknown>)
        : {};
    const catalogDatasets = Array.isArray(catalogRecord.datasets)
      ? catalogRecord.datasets
          .map((candidate) => {
            const item =
              candidate && typeof candidate === "object"
                ? (candidate as Record<string, unknown>)
                : {};
            return { name: item.name, description: item.description };
          })
          .slice(0, 30)
      : [];
    const context = {
      unitCount: units.length,
      units: units.map((unit) => ({
        name: unit.name,
        brand: unit.brand,
        group: unit.group,
      })),
      queryCatalog: { datasets: catalogDatasets, rules: catalogRecord.rules },
    };
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const user = await anonymousUserId(identity.user.id);
    const result = await runInvestigation(
      input,
      systemPrompt(context, today),
      today,
      {
        onProgress(progress) {
          toolCallCount = progress.calls;
          validationAttempts = Math.min(3, progress.validationAttempts);
          for (const dataset of progress.datasets) queriedDatasets.add(dataset);
        },
        async model(messages, tools, remainingMs) {
          const body = JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 2400,
            user,
            provider: { data_collection: "deny", zdr: true },
            ...(tools.length ? { tools, tool_choice: "auto" } : {}),
          });
          const modelStarted = Date.now();
          for (let attempt = 0; attempt < 2; attempt++) {
            const response = await fetch(openRouterUrl, {
              method: "POST",
              signal: AbortSignal.timeout(
                Math.min(
                  40000,
                  Math.max(
                    1000,
                    remainingMs - (Date.now() - modelStarted) - 2000,
                  ),
                ),
              ),
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://app-ceo-hos.vercel.app",
                "X-OpenRouter-Title": "CEO de bolso KPH",
              },
              body,
            });
            if (response.ok) {
              const payload = await response.json();
              const message = payload?.choices?.[0]?.message;
              if (!message || payload?.choices?.[0]?.finish_reason === "length")
                throw Error("openrouter_incomplete_response");
              return {
                message,
                promptTokens: Number(payload?.usage?.prompt_tokens ?? 0),
                completionTokens: Number(
                  payload?.usage?.completion_tokens ?? 0,
                ),
              };
            }
            if (
              attempt === 0 &&
              shouldRetryModelRequest(response.status) &&
              remainingMs > 45000
            ) {
              await wait(retryAfterMs(response, attempt));
              continue;
            }
            throw Error(`openrouter_http_${response.status}`);
          }
          throw Error("openrouter_unavailable");
        },
        async query(rpc, args, remainingMs) {
          const { data, error } = await supabase!
            .rpc(rpc, args)
            .abortSignal(
              AbortSignal.timeout(
                Math.min(40000, Math.max(1000, remainingMs - 2000)),
              ),
            );
          if (error) throw error;
          return data;
        },
      },
    );
    toolCallCount = result.calls;
    validationAttempts = Math.min(3, result.validationAttempts);
    for (const item of result.evidence)
      queriedDatasets.add(item.result.dataset ?? "financeiro");
    const sources = normalizeAssistantSources(
      result.evidence.map(
        (item) =>
          `${item.result.dataset ?? "financeiro"} · ${item.result.from ?? "início"} a ${item.result.to ?? "hoje"}`,
      ),
    );
    const conversationState = result.state;
    const answer = result.answer;
    const promptTokens = result.promptTokens;
    const completionTokens = result.completionTokens;
    await finish("success", "investigation_v1", promptTokens, completionTokens);
    console.log(
      JSON.stringify({
        operation: "assistant.ask",
        outcome: "success",
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        validationAttempts,
      }),
    );
    return reply({
      answer: answer.trim().slice(0, 6000),
      sources: normalizeAssistantSources(sources),
      updatedAt: new Date().toISOString(),
      modelId: model,
      requestId,
      conversationState,
    });
  } catch (error) {
    const code = errorCode(error);
    const upstreamStatus = providerStatus(error);
    await finish("error", code);
    console.error(
      JSON.stringify({
        operation: "assistant.ask",
        outcome: "error",
        code,
        upstreamStatus,
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
    const status =
      code === "rate_limited"
        ? 429
        : code === "forbidden"
          ? 403
          : code === "invalid_request"
            ? 400
            : 502;
    return reply({ error: code, requestId }, status);
  }
});
