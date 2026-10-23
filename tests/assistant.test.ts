import { describe, expect, it } from "vitest";
import {
  assistantDatasets,
  assistantModel,
  assistantModels,
  deterministicAssistantAnswer,
  evidenceReviewPrompt,
  minimizeAssistantContext,
  needsFinanceTool,
  needsKphTool,
  normalizeAssistantSources,
  parseAssistantInput,
  parseFinanceToolInput,
  parseKphQueryToolInput,
  planAssistantQueries,
  preferPurchaseItems,
  preferredDatasetForQuestion,
  shouldRetryModelRequest,
  systemPrompt,
  verifyAssistantAnswer,
} from "../supabase/functions/_shared/assistant";

describe("assistant boundary", () => {
  it("uses the approved OpenRouter model", () => {
    expect(assistantModel).toBe("deepseek/deepseek-v4.1-flash");
    expect(assistantModels).toHaveLength(4);
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
    expect(assistantDatasets).toContain("conciliacao_pagamentos");
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
    expect(
      preferredDatasetForQuestion("Mostre as linhas do DRE", "dre_mensal"),
    ).toBe("dre_detalhes");
  });

  it("accepts a bounded conversation without client-selected unit scope", () => {
    const parsed = parseAssistantInput({
      question: "  Como está a meta?  ",
      history: [{ role: "assistant", content: " Contexto anterior " }],
    });
    expect(parsed.question).toBe("Como está a meta?");
    expect(parsed.history[0]?.content).toBe("Contexto anterior");
    expect(parsed.modelId).toBe(assistantModel);
    expect(
      parseAssistantInput({
        question: "Como está a meta?",
        history: [],
        modelId: "openai/gpt-6-luna",
      }).modelId,
    ).toBe("openai/gpt-6-luna");
    expect(() =>
      parseAssistantInput({
        question: "Como está a meta?",
        history: [],
        modelId: "modelo/arbitrario",
      }),
    ).toThrow("invalid_model");
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

  it("plans common executive questions deterministically", () => {
    expect(
      planAssistantQueries("Quanto o Meet faturou ontem?", "2026-10-23", [
        "Meet & Eat",
        "Frêneze",
      ]),
    ).toEqual([
      {
        dataset: "financeiro",
        from: "2026-10-22",
        to: "2026-10-22",
        unit: "Meet & Eat",
        search: undefined,
        grain: "day",
        limit: 200,
      },
    ]);
    expect(
      planAssistantQueries(
        "Quanto comprei de carne esse mês?",
        "2026-10-23",
      )?.[0],
    ).toMatchObject({
      dataset: "compras_itens",
      from: "2026-10-01",
      to: "2026-10-23",
      search: "carne",
    });
    expect(
      planAssistantQueries(
        "Qual foi a conta de luz este mês?",
        "2026-10-23",
      )?.[0],
    ).toMatchObject({ dataset: "despesas", search: "luz" });
    expect(
      planAssistantQueries("Quais contas estão vencidas?", "2026-10-23")?.[0]
        ?.dataset,
    ).toBe("contas_pagar");
  });

  it("keeps the prior subject in a period follow-up", () => {
    const followUp = planAssistantQueries(
      "E no mês passado?",
      "2026-10-23",
      ["Meet & Eat"],
      [
        { role: "user", content: "Quanto o Meet faturou este mês?" },
        { role: "assistant", content: "Resposta anterior" },
      ],
    );
    expect(followUp).not.toBeNull();
    expect(followUp![0]).toMatchObject({
      dataset: "financeiro",
      from: "2026-09-01",
      to: "2026-09-30",
      unit: "Meet & Eat",
    });
  });

  it("keeps structured subject and search without relying on answer text", () => {
    const followUp = planAssistantQueries(
      "E no mês passado?",
      "2026-10-23",
      ["Meet & Eat"],
      [],
      {
        dataset: "compras_itens",
        from: "2026-10-01",
        to: "2026-10-23",
        unit: "Meet & Eat",
        search: "carne",
        grain: "day",
      },
    );
    expect(followUp?.[0]).toMatchObject({
      dataset: "compras_itens",
      from: "2026-09-01",
      to: "2026-09-30",
      unit: "Meet & Eat",
      search: "carne",
    });
  });

  it("validates bounded structured conversation state", () => {
    expect(
      parseAssistantInput({
        question: "E no mês passado?",
        history: [],
        conversationState: {
          dataset: "financeiro",
          from: "2026-10-01",
          to: "2026-10-23",
          grain: "day",
        },
      }).conversationState,
    ).toMatchObject({ dataset: "financeiro", from: "2026-10-01" });
    expect(() =>
      parseAssistantInput({
        question: "continue",
        history: [],
        conversationState: { dataset: "segredo", grain: "day" },
      }),
    ).toThrow("invalid_assistant_query");
  });

  it("separates independent and compound questions", () => {
    expect(
      planAssistantQueries(
        "Qual foi a conta de luz este mês?",
        "2026-10-23",
        [],
        [{ role: "user", content: "Quanto comprei de carne?" }],
      ),
    ).toHaveLength(1);
    expect(
      planAssistantQueries(
        "Quanto comprei de carne? E qual foi a conta de luz?",
        "2026-10-23",
      )?.map((query) => query.dataset),
    ).toEqual(["compras_itens", "despesas"]);
  });

  it("rejects numbers that are absent from database evidence", () => {
    const evidence = {
      summary: { totalValue: 46055.53, customers: 168, goalProgress: 92.11 },
      from: "2026-10-22",
      to: "2026-10-22",
    };
    expect(
      verifyAssistantAnswer(
        "O faturamento foi R$ 46.055,53, com 168 clientes e 92,1% da meta.",
        evidence,
        { question: "Quanto faturou ontem?", today: "2026-10-23" },
      ),
    ).toEqual({ valid: true, unsupported: [] });
    expect(
      verifyAssistantAnswer("O faturamento foi R$ 99.999,00.", evidence, {
        question: "Quanto faturou ontem?",
        today: "2026-10-23",
      }),
    ).toEqual({ valid: false, unsupported: ["99.999,00"] });
  });

  it("answers meat purchases directly from the database summary", () => {
    const evidence = [
      {
        query: {
          dataset: "compras_itens",
          from: "2026-10-01",
          to: "2026-10-23",
          search: "carne",
        },
        result: {
          from: "2026-10-01",
          to: "2026-10-23",
          summary: {
            totalValue: 220653.18,
            invoiceCount: 44,
            lineCount: 88,
            classification: "A. PROTEINAS",
            byUnit: [
              { unitName: "Meet & Eat", totalValue: 85969.2 },
              { unitName: "Frêneze", totalValue: 108303.2 },
            ],
          },
          rows: [{ firstIssueDate: "2026-10-02", lastIssueDate: "2026-10-21" }],
        },
      },
    ];
    const amount = deterministicAssistantAnswer(
      "Quanto compramos de carne esse mês?",
      evidence,
    );
    expect(amount).toContain("220.653,18");
    expect(amount).toContain("44 notas");
    expect(amount).toContain("Meet & Eat");
    expect(amount).toContain("85.969,20");
    expect(verifyAssistantAnswer(amount!, evidence, {})).toEqual({
      valid: true,
      unsupported: [],
    });

    const dates = deterministicAssistantAnswer(
      "Quando compramos carne esse mês?",
      evidence,
    );
    expect(dates).toContain("entre 02/10/2026 e 21/10/2026");
  });

  it("answers recipe costs only when the database marks them reliable", () => {
    const evidence = [
      {
        query: {
          dataset: "fichas_tecnicas",
          from: "2026-10-01",
          to: "2026-10-23",
          search: "risoto",
        },
        result: {
          from: "2026-10-01",
          to: "2026-10-23",
          summary: {
            recipeCount: 2,
            reliableCostCount: 1,
            recipesWithMissingCosts: 1,
          },
          rows: [
            {
              dishName: "Risoto",
              unitName: "Meet & Eat",
              trustedCost: 42.5,
              costReliable: true,
            },
            {
              dishName: "Risoto",
              unitName: "Frêneze",
              trustedCost: null,
              costReliable: false,
            },
          ],
        },
      },
    ];
    const answer = deterministicAssistantAnswer(
      "Qual o custo da ficha técnica do risoto?",
      evidence,
    );
    expect(answer).toContain("42,50");
    expect(answer).not.toContain("Frêneze");
  });

  it("answers goods receipts without adding incompatible quantities", () => {
    const evidence = [
      {
        query: {
          dataset: "recebimentos",
          from: "2026-06-01",
          to: "2026-06-30",
        },
        result: {
          from: "2026-06-01",
          to: "2026-06-30",
          summary: {
            receiptCount: 8,
            itemLineCount: 8,
            divergentItemCount: 4,
            byUnit: [{ unitName: "Meet & Eat", receiptCount: 8 }],
          },
          rows: [],
        },
      },
    ];
    const answer = deterministicAssistantAnswer(
      "Quantos recebimentos de mercadoria tivemos?",
      evidence,
    );
    expect(answer).toContain("8 recebimentos");
    expect(answer).toContain("4 divergências");
    expect(answer).not.toContain("quantidade total");
  });

  it("answers cash register differences from database summaries", () => {
    const evidence = [
      {
        query: { dataset: "caixas", from: "2026-10-22", to: "2026-10-22" },
        result: {
          from: "2026-10-22",
          to: "2026-10-22",
          summary: {
            registerCount: 4,
            closedValue: 1000,
            receivedValue: 990,
            difference: 10,
            openRegisterCount: 0,
            byUnit: [],
          },
          rows: [],
        },
      },
    ];
    const answer = deterministicAssistantAnswer(
      "Qual foi a diferença de caixa ontem?",
      evidence,
    );
    expect(answer).toContain("10,00");
    expect(answer).toContain("0 caixas sem horário de fechamento");
  });

  it("answers expenses from a complete database aggregate", () => {
    const evidence = [
      {
        query: {
          dataset: "despesas",
          from: "2026-04-01",
          to: "2026-04-30",
          search: "marketing",
        },
        result: {
          from: "2026-04-01",
          to: "2026-04-30",
          summary: {
            expenseCount: 12,
            totalValue: 45678.9,
            authorizedUnitCount: 4,
            unitsWithDataCount: 2,
            missingUnits: ["Frêneze", "Match Point"],
            byUnit: [
              { unitName: "Meet & Eat", totalValue: 25000, expenseCount: 7 },
              { unitName: "Madonna", totalValue: 20678.9, expenseCount: 5 },
            ],
          },
          rows: [],
        },
      },
    ];
    const answer = deterministicAssistantAnswer(
      "Quanto gastamos com marketing?",
      evidence,
    );
    expect(answer).toContain("45.678,90");
    expect(answer).toContain("12 despesas");
    expect(answer).toContain("2 de 4 casas");
  });

  it("answers realized DRE without mixing it with budget", () => {
    const evidence = [
      {
        query: { dataset: "dre_mensal", from: "2026-04-01", to: "2026-04-30" },
        result: {
          from: "2026-04-01",
          to: "2026-04-30",
          summary: {
            byType: [
              {
                type: "orcado",
                grossRevenue: 2000000,
                cmv: -500000,
                people: -400000,
                ebitda: 300000,
                netResult: 250000,
              },
              {
                type: "realizado",
                grossRevenue: 1750000,
                cmv: -490000,
                people: -385000,
                ebitda: 210000,
                netResult: 165000,
              },
            ],
          },
          rows: [],
        },
      },
    ];
    const answer = deterministicAssistantAnswer(
      "Qual foi o EBITDA realizado?",
      evidence,
    );
    expect(answer).toContain("210.000,00");
    expect(answer).not.toContain("300.000,00");
  });

  it("answers payment reconciliation without exposing statement details", () => {
    const evidence = [
      {
        query: {
          dataset: "conciliacao_pagamentos",
          from: "2026-10-01",
          to: "2026-10-23",
        },
        result: {
          from: "2026-10-01",
          to: "2026-10-23",
          summary: {
            shifts: 98,
            reconciledShifts: 95,
            closedPaymentValue: 1740672.44,
            receivedPaymentValue: 1742847.17,
            difference: -2174.73,
            byUnit: [],
          },
          rows: [],
        },
      },
    ];
    const answer = deterministicAssistantAnswer(
      "Quantos pagamentos estão conciliados?",
      evidence,
    );
    expect(answer).toContain("95 de 98 turnos");
    expect(answer).toContain("-R$ 2.174,73");
    expect(answer).not.toContain("conta bancária");
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
    expect(prompt).toContain("trustedCost");
    expect(prompt).toContain("unidades diferentes");
    expect(prompt).toContain("difference");
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
