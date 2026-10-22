import { describe, expect, it } from "vitest";
import {
  assistantDatasets,
  assistantModel,
  minimizeAssistantContext,
  needsFinanceTool,
  needsKphTool,
  parseAssistantInput,
  parseFinanceToolInput,
  parseKphQueryToolInput,
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
