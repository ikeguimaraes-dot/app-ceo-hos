// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  assistantDatasets,
  assistantModel,
  minimizeAssistantContext,
  needsKphTool,
  normalizeAssistantSources,
  parseAssistantInput,
  parseKphQueryToolInput,
  shouldRetryModelRequest,
  systemPrompt,
} from "../_shared/assistant.ts";

const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const kphTool = {
  type: "function",
  function: {
    name: "consultar_kph",
    description:
      "Consulta o banco KPH real, em modo somente leitura, para todas as casas autorizadas. Pode ser chamada várias vezes para cruzar áreas ou refinar resultados.",
    parameters: {
      type: "object",
      properties: {
        dataset: {
          type: "string",
          enum: assistantDatasets,
          description:
            "Área de dados: financeiro, DRE, despesas, compras, manutenção, pessoas, ausências, planos ou pedidos de venda.",
        },
        from: {
          type: "string",
          description:
            "Data inicial inclusiva em YYYY-MM-DD. Pode abranger todo o histórico desde 2000.",
        },
        to: {
          type: "string",
          description: "Data final inclusiva em YYYY-MM-DD.",
        },
        unit: {
          type: "string",
          description:
            "Nome ou trecho da casa, marca ou grupo. Omita para todas as casas autorizadas.",
        },
        search: {
          type: "string",
          description:
            "Texto opcional para filtrar nomes, descrições, fornecedores, cargos ou estados.",
        },
        grain: {
          type: "string",
          enum: ["day", "month"],
          description:
            "Granularidade do financeiro. Use month para períodos longos.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description:
            "Máximo de linhas. Use filtros para manter o resultado preciso.",
        },
      },
      required: ["dataset"],
      additionalProperties: false,
    },
  },
} as const;

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
    const { data: catalog, error: catalogError } = await supabase.rpc(
      "ghost_assistant_catalog_v1",
    );
    if (catalogError) throw catalogError;
    const context = {
      unitCount: units.length,
      units: unitContexts,
      queryCatalog: catalog,
    };
    const sources = ["Dashboard", "Operação", "Pessoas", "Pendências"]
      .map((name) => ({
        name,
        count: unitContexts.filter((unit) => name in unit.data).length,
      }))
      .filter((source) => source.count > 0)
      .map((source) => `${source.name} (${source.count} casas)`);

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const messages: Record<string, unknown>[] = [
      { role: "system", content: systemPrompt(context, today) },
      ...input.history,
      { role: "user", content: input.question },
    ];
    const user = await anonymousUserId(identity.user.id);
    const callModel = async (
      conversation: Record<string, unknown>[],
      withTools: boolean,
      forceTool = false,
    ) => {
      const body = JSON.stringify({
        model,
        messages: conversation,
        temperature: 0.2,
        max_tokens: 700,
        user,
        provider: { data_collection: "deny", zdr: true },
        ...(withTools
          ? {
              tools: [kphTool],
              tool_choice: forceTool
                ? {
                    type: "function",
                    function: { name: "consultar_kph" },
                  }
                : "auto",
            }
          : {}),
      });
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(openRouterUrl, {
            method: "POST",
            signal: AbortSignal.timeout(25_000),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://app-ceo-hos.vercel.app",
              "X-OpenRouter-Title": "Ghost KPH",
            },
            body,
          });
          if (response.ok) return response.json();
          lastError = new Error(`openrouter_http_${response.status}`);
          if (attempt === 0 && shouldRetryModelRequest(response.status)) {
            await wait(retryAfterMs(response, attempt));
            continue;
          }
          throw lastError;
        } catch (error) {
          lastError = error;
          const status = Number(providerStatus(error));
          const transient =
            !status || (Number.isFinite(status) && shouldRetryModelRequest(status));
          if (attempt === 0 && transient) {
            await wait(450);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    };

    let payload = await callModel(messages, true, needsKphTool(input.question));
    let modelMessage = payload?.choices?.[0]?.message;
    let promptTokens = Number(payload?.usage?.prompt_tokens ?? 0);
    let completionTokens = Number(payload?.usage?.completion_tokens ?? 0);
    for (let round = 0; round < 4; round += 1) {
      const toolCalls = Array.isArray(modelMessage?.tool_calls)
        ? modelMessage.tool_calls
            .filter(
              (call: { function?: { name?: string } }) =>
                call.function?.name === "consultar_kph",
            )
            .slice(0, 3)
        : [];
      if (!toolCalls.length) break;
      messages.push({
        role: "assistant",
        content: modelMessage.content ?? null,
        tool_calls: toolCalls,
      });
      for (const toolCall of toolCalls) {
        const query = parseKphQueryToolInput(toolCall.function?.arguments);
        const { data, error } = await supabase.rpc("ghost_assistant_query_v1", {
          p_dataset: query.dataset,
          p_from: query.from ?? null,
          p_to: query.to ?? null,
          p_unit: query.unit ?? null,
          p_search: query.search ?? null,
          p_grain: query.grain,
          p_limit: query.limit,
        });
        if (error) throw error;
        const period = `${data?.from ?? query.from ?? "início"} a ${data?.to ?? query.to ?? "hoje"}`;
        sources.push(`${query.dataset} · ${period}`);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: "consultar_kph",
          content: JSON.stringify(data),
        });
      }
      payload = await callModel(messages, round < 3);
      modelMessage = payload?.choices?.[0]?.message;
      promptTokens += Number(payload?.usage?.prompt_tokens ?? 0);
      completionTokens += Number(payload?.usage?.completion_tokens ?? 0);
    }
    const answer = modelMessage?.content;
    if (typeof answer !== "string" || !answer.trim())
      throw new Error("openrouter_empty_response");
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
      sources: normalizeAssistantSources(sources),
      updatedAt: new Date().toISOString(),
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
