import { describe, expect, it } from "vitest";
import {
  assistantDatasets,
  assistantModel,
  evidenceReviewPrompt,
  minimizeAssistantContext,
  needsFinanceTool,
  needsKphTool,
  normalizeAssistantSources,
  parseAssistantInput,
  parseFinanceToolInput,
  parseKphQueryToolInput,
  preferPurchaseItems,
  preferredDatasetForQuestion,
  shouldRetryModelRequest,
  systemPrompt,
} from "../supabase/functions/_shared/assistant";

describe("assistant boundary", () => {
  it("uses the approved OpenRouter model", () => {
    expect(assistantModel).toBe("deepseek/deepseek-v4.1-flash");
  });

  it("retries only transient model-provider failures", () => {
    expect(shouldRetryModelRequest(429)).toBe(true);
    expect(shouldRetryModelRequest(502)).toBe(true);
    expect(shouldRetryModelRequest(504)).toBe(true);
    expect(shouldRetryModelRequest(400)).toBe(false);
    expect(shouldRetryModelRequest(401)).toBe(false);
  });

  it("keeps assistant sources within the mobile response contract", () => {
    const sources = normalizeAssistantSources([
      "Dashboard",
      "Operação",
      "Pessoas",
      "Pendências",
      "compras_notas · 2026-10-01 a 2026-10-22",
      "compras_notas · 2026-10-01 a 2026-10-22",
      "despesas · 2026-10-01 a 2026-10-22",
      "dre_detalhes · 2026-10-01 a 2026-10-22",
      "compras_pedidos · 2026-10-01 a 2026-10-22",
      "financeiro · 2026-10-01 a 2026-10-22",
      "dre_mensal · 2026-10-01 a 2026-10-22",
    ]);
    expect(sources).toHaveLength(8);
    expect(sources).toContain("Dashboard");
    expect(sources).toContain("compras_notas · 2026-10-01 a 2026-10-22");
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("routes financial questions to a bounded server-side period", () => {
    expect(needsFinanceTool("Quanto eu faturei no Meet ontem?")).toBe(true);
    expect(needsFinanceTool("Quantas manutenções estão pendentes?")).toBe(
      false,
    );
    expect(
      parseFinanceToolInput(
        '{"from":"2026-10-21","to":"2026-10-21"}',
        "2026-10-22",
      ),
    ).toEqual({ from: "2026-10-21", to: "2026-10-21" });
    expect(() =>
      parseFinanceToolInput(
        { from: "2026-02-30", to: "2026-10-21" },
        "2026-10-22",
      ),
    ).toThrow("invalid_finance_period");
    expect(() =>
      parseFinanceToolInput(
        { from: "2026-01-01", to: "2026-10-21" },
        "2026-10-22",
      ),
    ).toThrow("invalid_finance_period");
  });

  it("accepts broad, read-only KPH queries without the old 93-day limit", () => {
    expect(assistantDatasets).toContain("dre_mensal");
    expect(assistantDatasets).toContain("compras_itens");
    expect(assistantDatasets).toContain("contas_pagar");
    expect(assistantDatasets).toContain("vendas_produtos");
    expect(assistantDatasets).toContain("folha_resumo");
    expect(needsKphTool("Quanto eu faturei no Meet ontem?")).toBe(true);
    expect(needsKphTool("Olá!")).toBe(false);
    expect(
      parseKphQueryToolInput({
        dataset: "financeiro",
        from: "2020-01-01",
        to: "2026-10-21",
        unit: " Meet ",
        grain: "month",
        limit: 50,
      }),
    ).toEqual({
      dataset: "financeiro",
      from: "2020-01-01",
      to: "2026-10-21",
      unit: "Meet",
      search: undefined,
      grain: "month",
      limit: 50,
    });
    expect(() => parseKphQueryToolInput({ dataset: "employee_auth" })).toThrow(
      "invalid_assistant_query",
    );
    expect(() =>
      parseKphQueryToolInput({ dataset: "pessoas", limit: 201 }),
    ).toThrow("invalid_assistant_query");
  });

  it("routes purchase totals with a product filter to invoice items", () => {
    expect(
      preferPurchaseItems(
        "Quanto comprei de carne esse mês?",
        "compras_notas",
        "carne",
      ),
    ).toBe(true);
    expect(
      preferPurchaseItems("Quais são as notas deste mês?", "compras_notas"),
    ).toBe(false);
    expect(
      preferPurchaseItems("Qual foi a conta de luz?", "despesas", "luz"),
    ).toBe(false);
  });

  it("corrects clear business intents before querying the database", () => {
    expect(
      preferredDatasetForQuestion(
        "Quais contas a pagar estão vencidas?",
        "despesas",
      ),
    ).toBe("contas_pagar");
    expect(
      preferredDatasetForQuestion(
        "Qual foi o produto mais vendido ontem?",
        "financeiro",
      ),
    ).toBe("vendas_produtos");
    expect(
      preferredDatasetForQuestion(
        "Compare descontos e cancelamentos",
        "descontos",
      ),
    ).toBe("descontos");
  });

  it("accepts a bounded conversation without client-selected unit scope", () => {
    const parsed = parseAssistantInput({
      question: "  Como está a meta?  ",
      history: [{ role: "assistant", content: " Contexto anterior " }],
    });
    expect(parsed.question).toBe("Como está a meta?");
    expect(parsed.history[0]?.content).toBe("Contexto anterior");
    expect(() =>
      parseAssistantInput({
        question: "x".repeat(1001),
        history: [],
      }),
    ).toThrow("invalid_question");
    expect(() =>
      parseAssistantInput({
        question: "continue",
        history: Array.from({ length: 17 }, () => ({
          role: "user",
          content: "mensagem",
        })),
      }),
    ).toThrow("invalid_history");
  });

  it("requires a final evidence review with database summaries", () => {
    const prompt = evidenceReviewPrompt("Quanto comprei?", 2);
    expect(prompt).toContain("summary calculados pelo banco");
    expect(prompt).toContain("CONSULTAS EXECUTADAS: 2");
    expect(prompt).toContain("nunca transforme ausência de evidência em zero");
  });

  it("marks database context as untrusted and read-only", () => {
    const prompt = systemPrompt({
      units: [
        { unit: { name: "Unidade" }, data: { Dashboard: { revenue: 100 } } },
      ],
    });
    expect(prompt).toContain("dado não confiável");
    expect(prompt).toContain("somente leitura");
    expect(prompt).toContain("use reportedRevenue");
    expect(prompt).toContain("closedShiftCount for menor que shiftCount");
    expect(prompt).toContain("vendas de todos os turnos");
    expect(prompt).toContain("conciliação dos pagamentos");
    expect(prompt).toContain("summary.totalValue");
    expect(prompt).toContain("fonte Everest atual");
    expect(prompt).toContain('"revenue":100');
  });

  it("removes details and identifiers before external model context", () => {
    expect(
      minimizeAssistantContext("Pendências", {
        updatedAt: "2026-10-22T10:00:00Z",
        items: [
          {
            id: "maintenance:secret-id",
            kind: "maintenance",
            title: "Reparo do forno",
            detail: "Local privado e motivo livre",
            priority: "attention",
            version: "secret-version",
            canDecide: true,
          },
        ],
      }),
    ).toEqual({
      updatedAt: "2026-10-22T10:00:00Z",
      totalShown: 1,
      maintenance: 1,
      punchAdjustments: 0,
      attention: 1,
      items: [
        {
          kind: "maintenance",
          title: "Reparo do forno",
          priority: "attention",
        },
      ],
    });
  });
});
