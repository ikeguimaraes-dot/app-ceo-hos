// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  assistantDatasets,
  assistantModel,
  deterministicAssistantAnswer,
  evidenceReviewPrompt,
  needsKphTool,
  normalizeAssistantSources,
  parseAssistantInput,
  parseKphQueryToolInput,
  planAssistantQueries,
  preferredDatasetForQuestion,
  shouldRetryModelRequest,
  systemPrompt,
  verifyAssistantAnswer,
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
            "Área de dados. Para valores comprados por produto ou categoria use compras_itens; para listar notas use compras_notas.",
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
    const input = parseAssistantInput(await request.json());
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
    const sources: string[] = [];
    const evidence: unknown[] = [];
    let conversationState = input.conversationState;

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
      structured = false,
    ) => {
      const body = JSON.stringify({
        model,
        messages: conversation,
        temperature: 0.2,
        max_tokens: structured ? 1200 : 700,
        user,
        provider: { data_collection: "deny", zdr: true },
        ...(structured
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "ghost_answer",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: { answer: { type: "string" } },
                    required: ["answer"],
                    additionalProperties: false,
                  },
                },
              },
            }
          : {}),
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
            !status ||
            (Number.isFinite(status) && shouldRetryModelRequest(status));
          if (attempt === 0 && transient) {
            await wait(450);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    };

    const executeQuery = async (
      query: ReturnType<typeof parseKphQueryToolInput>,
    ) => {
      const { data, error } = await supabase!.rpc("ghost_assistant_query_v4", {
        p_dataset: query.dataset,
        p_from: query.from ?? null,
        p_to: query.to ?? null,
        p_unit: query.unit ?? null,
        p_search: query.search ?? null,
        p_grain: query.grain,
        p_limit: query.limit,
      });
      if (error) throw error;
      queriedDatasets.add(query.dataset);
      const period = `${data?.from ?? query.from ?? "início"} a ${data?.to ?? query.to ?? "hoje"}`;
      sources.push(`${query.dataset} · ${period}`);
      evidence.push({ query, result: data });
      conversationState = {
        dataset: query.dataset,
        from: data?.from ?? query.from,
        to: data?.to ?? query.to,
        unit: query.unit,
        search: query.search,
        grain: query.grain,
      };
      return data;
    };
    const plannedQueries = planAssistantQueries(
      input.question,
      today,
      units.flatMap((unit) => [unit.name, unit.brand]).filter(Boolean),
      input.history,
      input.conversationState,
    );
    let payload: Record<string, any>;
    let modelMessage: Record<string, any> | undefined;
    let promptTokens = 0;
    let completionTokens = 0;
    let deterministic = false;

    if (plannedQueries?.length) {
      for (const query of plannedQueries) {
        toolCallCount += 1;
        await executeQuery(query);
      }
      const serverAnswer = deterministicAssistantAnswer(
        input.question,
        evidence,
      );
      if (serverAnswer) {
        deterministic = true;
        payload = {};
        modelMessage = { content: serverAnswer };
      } else {
        messages.push({
          role: "system",
          content: [
            "EVIDÊNCIA CONSULTADA DIRETAMENTE NO BANCO KPH:",
            JSON.stringify(evidence),
            evidenceReviewPrompt(input.question, toolCallCount),
            "Responda em JSON no formato solicitado.",
          ].join("\n"),
        });
        payload = await callModel(messages, false, false, true);
        modelMessage = payload?.choices?.[0]?.message;
        promptTokens = Number(payload?.usage?.prompt_tokens ?? 0);
        completionTokens = Number(payload?.usage?.completion_tokens ?? 0);
      }
    } else {
      payload = await callModel(messages, true, needsKphTool(input.question));
      modelMessage = payload?.choices?.[0]?.message;
      promptTokens = Number(payload?.usage?.prompt_tokens ?? 0);
      completionTokens = Number(payload?.usage?.completion_tokens ?? 0);
    }
    for (let round = 0; !plannedQueries && round < 4; round += 1) {
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
        toolCallCount += 1;
        let query = parseKphQueryToolInput(toolCall.function?.arguments);
        query = {
          ...query,
          dataset: preferredDatasetForQuestion(
            input.question,
            query.dataset,
            query.search,
          ),
        };
        const data = await executeQuery(query);
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
    let answer = modelMessage?.content;
    if (plannedQueries && !deterministic && typeof answer === "string") {
      try {
        const structured = JSON.parse(answer);
        answer = structured?.answer;
      } catch {
        // Some OpenRouter providers return valid text even when they do not
        // honor response_format. Keep that text as a safe compatibility path.
      }
    }
    if (needsKphTool(input.question) && toolCallCount === 0)
      throw new Error("assistant_no_evidence");
    if (!plannedQueries && toolCallCount > 0) {
      if (typeof answer === "string" && answer.trim())
        messages.push({ role: "assistant", content: answer.trim() });
      messages.push({
        role: "user",
        content: evidenceReviewPrompt(input.question, toolCallCount),
      });
      payload = await callModel(messages, false, false, true);
      modelMessage = payload?.choices?.[0]?.message;
      promptTokens += Number(payload?.usage?.prompt_tokens ?? 0);
      completionTokens += Number(payload?.usage?.completion_tokens ?? 0);
      answer = modelMessage?.content;
      if (typeof answer === "string") {
        try {
          answer = JSON.parse(answer)?.answer;
        } catch {
          // Compatibility fallback for providers without structured output.
        }
      }
    }
    if (typeof answer !== "string" || !answer.trim())
      throw new Error("openrouter_empty_response");
    let verification = verifyAssistantAnswer(answer, evidence, {
      question: input.question,
      today,
      unitCount: units.length,
      sources,
    });
    validationAttempts = 1;
    if (!verification.valid) {
      messages.push({ role: "assistant", content: answer.trim() });
      messages.push({
        role: "user",
        content: [
          "A resposta contém números que não aparecem nas evidências autorizadas:",
          verification.unsupported.join(", "),
          "Reescreva sem calcular, estimar ou acrescentar números. Use somente valores exatos presentes nas evidências. Responda em JSON no formato solicitado.",
        ].join("\n"),
      });
      payload = await callModel(messages, false, false, true);
      promptTokens += Number(payload?.usage?.prompt_tokens ?? 0);
      completionTokens += Number(payload?.usage?.completion_tokens ?? 0);
      const corrected = payload?.choices?.[0]?.message?.content;
      if (typeof corrected !== "string" || !corrected.trim())
        throw new Error("openrouter_empty_response");
      try {
        answer = JSON.parse(corrected)?.answer;
      } catch {
        answer = corrected;
      }
      validationAttempts += 1;
      if (typeof answer !== "string" || !answer.trim())
        throw new Error("openrouter_empty_response");
      verification = verifyAssistantAnswer(answer, evidence, {
        question: input.question,
        today,
        unitCount: units.length,
        sources,
      });
      if (!verification.valid) throw new Error("assistant_unverified_numbers");
    }
    await finish(
      "success",
      deterministic ? "deterministic" : "ok",
      promptTokens,
      completionTokens,
    );
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
