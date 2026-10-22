// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  assistantModel,
  minimizeAssistantContext,
  parseAssistantInput,
  systemPrompt,
} from "../_shared/assistant.ts";

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
  return "assistant_failed";
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
  if (length > 32_768) return reply({ error: "request_too_large" }, 413);

  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  const model = Deno.env.get("OPENROUTER_MODEL") ?? assistantModel;
  let supabase: ReturnType<typeof createClient> | null = null;
  let began = false;
  const finish = async (
    outcome: "success" | "error",
    code: string,
    promptTokens = 0,
    completionTokens = 0,
  ) => {
    if (!began || !supabase) return;
    await supabase.rpc("ghost_assistant_finish_v1", {
      p_request_id: requestId,
      p_outcome: outcome,
      p_code: code,
      p_model: model,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
    });
  };

  try {
    if (!/^Bearer\s+\S+$/i.test(authorization))
      return reply({ error: "authentication_required" }, 401);
    const input = parseAssistantInput(await request.json());
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

    const unitContexts = await Promise.all(
      units.map(async (unit) => {
        const context: Record<string, unknown> = {};
        const load = async (
          name: string,
          rpc: string,
          args: Record<string, unknown>,
        ) => {
          const { data, error } = await supabase!.rpc(rpc, args);
          if (error) throw error;
          context[name] = minimizeAssistantContext(name, data);
        };
        if (unit.capabilities.includes("dashboard.read"))
          await load("Dashboard", "ghost_dashboard_v1", {
            p_unit_id: unit.id,
            p_month: new Date().toISOString().slice(0, 10),
          });
        if (unit.capabilities.includes("operation.read"))
          await load("Operação", "ghost_operation_summary_v1", {
            p_unit_id: unit.id,
          });
        if (unit.capabilities.includes("people.read"))
          await load("Pessoas", "ghost_people_summary_v1", {
            p_unit_id: unit.id,
          });
        if (unit.capabilities.includes("pending.read"))
          await load("Pendências", "ghost_pending_items_v2", {
            p_unit_id: unit.id,
            p_cursor: null,
            p_limit: 10,
          });
        return {
          unit: { name: unit.name, brand: unit.brand, group: unit.group },
          data: context,
        };
      }),
    );

    if (!unitContexts.some((unit) => Object.keys(unit.data).length))
      throw new Error("unit_capability_denied");
    const context = { unitCount: units.length, units: unitContexts };
    const sources = ["Dashboard", "Operação", "Pessoas", "Pendências"]
      .map((name) => ({
        name,
        count: unitContexts.filter((unit) => name in unit.data).length,
      }))
      .filter((source) => source.count > 0)
      .map((source) => `${source.name} (${source.count} casas)`);

    const response = await fetch(openRouterUrl, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://app-ceo-hos.vercel.app",
        "X-OpenRouter-Title": "Ghost KPH",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt(context) },
          ...input.history,
          { role: "user", content: input.question },
        ],
        temperature: 0.2,
        max_tokens: 700,
        user: await anonymousUserId(identity.user.id),
        provider: { data_collection: "deny", zdr: true },
      }),
    });
    if (!response.ok) throw new Error(`openrouter_http_${response.status}`);
    const payload = await response.json();
    const answer = payload?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim())
      throw new Error("openrouter_empty_response");
    const promptTokens = Number(payload?.usage?.prompt_tokens ?? 0);
    const completionTokens = Number(payload?.usage?.completion_tokens ?? 0);
    await finish("success", "ok", promptTokens, completionTokens);
    console.log(
      JSON.stringify({
        operation: "assistant.ask",
        outcome: "success",
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
    return reply({
      answer: answer.trim().slice(0, 6000),
      sources,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const code = errorCode(error);
    await finish("error", code);
    console.error(
      JSON.stringify({
        operation: "assistant.ask",
        outcome: "error",
        code,
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
