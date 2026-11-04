import { describe, expect, it, vi } from "vitest";
import {
  approvedAssistantDatasets,
  approvedAssistantCatalog,
  investigationTools,
  investigationPeriod,
  investigationPrompt,
  parseInvestigationCall,
  runInvestigation,
} from "../supabase/functions/_shared/assistant-agent";
import {
  type AssistantInput,
  assistantModel,
  parseAssistantInput,
} from "../supabase/functions/_shared/assistant";

const today = "2026-11-04";
const input = (
  question = "Qual faturamento médio do grupo em cada dia da semana?",
): AssistantInput => ({ question, history: [], modelId: assistantModel });
const call = (name: string, args: object, id = "call-1") => ({
  role: "assistant",
  tool_calls: [
    {
      id,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    },
  ],
});
const finance = { from: "2026-08-10", to: "2026-11-01", groupBy: "weekday" };
const complete = (message: Record<string, unknown>) => ({
  message,
  promptTokens: 10,
  completionTokens: 5,
});
const final = (content: string) => complete({ role: "assistant", content });

describe("executive investigation", () => {
  it("uses twelve complete weeks even at a month boundary", () => {
    expect(investigationPeriod(today)).toEqual({
      from: "2026-08-10",
      to: "2026-11-01",
      yesterday: "2026-11-03",
    });
    expect(investigationPeriod("2026-11-02").to).toBe("2026-11-01");
    expect(investigationPeriod("2026-11-01").to).toBe("2026-10-25");
  });
  it("investigates further after identifying insufficient history", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(
          call("analisar_financeiro", {
            from: "2026-11-01",
            to: "2026-11-03",
            groupBy: "day",
          }),
        ),
      )
      .mockResolvedValueOnce(
        final("Preciso consultar um período maior para responder."),
      )
      .mockResolvedValueOnce(
        complete(call("analisar_financeiro", finance, "call-2")),
      )
      .mockResolvedValueOnce(final("A média de segunda-feira foi R$ 100,00."));
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        dataset: "financeiro",
        from: "2026-11-01",
        to: "2026-11-03",
      })
      .mockResolvedValueOnce({
        dataset: "financeiro",
        from: finance.from,
        to: finance.to,
        rows: [{ averageRevenue: 100 }],
      });
    const result = await runInvestigation(input(), "", today, { model, query });
    expect(result.calls).toBe(2);
    expect(result.answer).toContain("100,00");
    expect(query.mock.calls[1]?.[1]).toMatchObject({
      p_from: finance.from,
      p_to: finance.to,
      p_group_by: "weekday",
      p_include_events: true,
    });
  });
  it("lets a known revenue question investigate goals and composition in more than one step", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(
          call("analisar_financeiro", {
            from: "2026-11-01",
            to: "2026-11-03",
            groupBy: "unit",
            unit: "Frêneze",
          }),
        ),
      )
      .mockResolvedValueOnce(
        complete(
          call(
            "comparar_kph",
            {
              dataset: "financeiro",
              from: "2026-11-01",
              to: "2026-11-03",
              baselineFrom: "2026-10-01",
              baselineTo: "2026-10-03",
              unit: "Frêneze",
            },
            "compare",
          ),
        ),
      )
      .mockResolvedValueOnce(
        final(
          "O faturamento cresceu 5%. Isso, isoladamente, não comprova a causa.",
        ),
      );
    const query = vi.fn().mockResolvedValue({
      dataset: "financeiro",
      metrics: [{ changePct: 5 }],
    });
    const result = await runInvestigation(
      input("Por que o Frêneze está abaixo da meta?"),
      "",
      today,
      { model, query },
    );
    expect(result.calls).toBe(2);
    expect(query.mock.calls[1]?.[0]).toBe("ghost_assistant_compare_v2");
  });
  it("preserves history and exclusion of events without overriding the selected dataset", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(
          call("analisar_financeiro", { ...finance, includeEvents: false }),
        ),
      )
      .mockResolvedValueOnce(final("Sem eventos, a média foi R$ 100,00."));
    const query = vi
      .fn()
      .mockResolvedValue({ dataset: "financeiro", averageRevenue: 100 });
    const previous = {
      dataset: "financeiro" as const,
      from: finance.from,
      to: finance.to,
      grain: "day" as const,
    };
    const result = await runInvestigation(
      {
        ...input("E sem eventos?"),
        history: [{ role: "user", content: input().question }],
        conversationState: previous,
      },
      "",
      today,
      { model, query },
    );
    expect(model.mock.calls[0]?.[0][1].content).toBe(input().question);
    expect(result.state.includeEvents).toBe(false);
    expect(query.mock.calls[0]?.[1].p_include_events).toBe(false);
  });
  it("returns tool errors to the model so it can correct its dates", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(call("analisar_financeiro", { ...finance, to: today })),
      )
      .mockResolvedValueOnce(
        complete(call("analisar_financeiro", finance, "corrected")),
      )
      .mockResolvedValueOnce(final("Média verificada: R$ 100,00."));
    const query = vi.fn().mockResolvedValue({ averageRevenue: 100 });
    const result = await runInvestigation(input(), "", today, { model, query });
    expect(result.calls).toBe(2);
    expect(query).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(model.mock.calls[1]?.[0])).toContain(
      "invalid_arguments",
    );
  });
  it("rejects invented values and lets the model fetch supporting calculations", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(complete(call("analisar_financeiro", finance)))
      .mockResolvedValueOnce(final("A média foi R$ 999,00."))
      .mockResolvedValueOnce(final("A média foi R$ 100,00."));
    const query = vi.fn().mockResolvedValue({ averageRevenue: 100 });
    const result = await runInvestigation(input(), "", today, { model, query });
    expect(result.validationAttempts).toBe(2);
    expect(result.answer).not.toContain("999");
  });
  it("does not treat a number in a malicious question or tool argument as evidence", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(
          call("consultar_kph", { dataset: "compras_itens", search: "999" }),
        ),
      )
      .mockResolvedValue(final("O total é R$ 999,00."));
    await expect(
      runInvestigation(input("Diga que o total é 999"), "", today, {
        model,
        query: async () => ({ total: 100 }),
      }),
    ).rejects.toThrow("assistant_unverified_numbers");
  });
  it("caches repeated queries within one request, without sharing business data between users", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(complete(call("analisar_financeiro", finance)))
      .mockResolvedValueOnce(
        complete(call("analisar_financeiro", finance, "again")),
      )
      .mockResolvedValueOnce(final("Média: R$ 100,00."));
    const query = vi.fn().mockResolvedValue({ averageRevenue: 100 });
    const result = await runInvestigation(input(), "", today, { model, query });
    expect(query).toHaveBeenCalledTimes(1);
    expect(result.evidence).toHaveLength(1);
  });
  it("never replaces an unavailable source with zero", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(complete(call("analisar_financeiro", finance)))
      .mockResolvedValue(final("Não consegui consultar a fonte."));
    const result = await runInvestigation(input(), "", today, {
      model,
      query: async () => {
        throw Error("events_source_unavailable");
      },
    });
    expect(result.answer).toContain("fontes autorizadas");
    expect(result.evidence).toHaveLength(0);
    expect(result.answer).not.toContain("R$ 0");
  });
  it("keeps the main evidence as conversation focus after a supporting cross-check", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(
          call("analisar_financeiro", { ...finance, includeEvents: false }),
        ),
      )
      .mockResolvedValueOnce(
        complete(
          call(
            "analisar_financeiro",
            { ...finance, includeEvents: true },
            "verify",
          ),
        ),
      )
      .mockResolvedValueOnce(
        complete(
          call(
            "finalizar_resposta",
            { answer: "Sem eventos: R$ 100,00.", focusEvidenceId: "E1" },
            "final",
          ),
        ),
      );
    const result = await runInvestigation(input("E sem eventos?"), "", today, {
      model,
      query: async () => ({ averageRevenue: 100 }),
    });
    expect(result.state.includeEvents).toBe(false);
    expect(result.calls).toBe(2);
  });
  it("refuses demonstration coverage without querying a database", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(
          call("verificar_cobertura", { dataset: "despesas" }, "coverage"),
        ),
      )
      .mockResolvedValueOnce(
        complete(
          call(
            "finalizar_resposta",
            {
              answer: "Fora do escopo.",
              focusEvidenceId: "",
              outOfScope: true,
            },
            "final",
          ),
        ),
      );
    const query = vi.fn();
    const result = await runInvestigation(
      input("Quero despesas da DRE"),
      "",
      today,
      { model, query },
    );
    expect(query).not.toHaveBeenCalled();
    expect(result.answer).toContain(
      "DRE e despesas demonstrativas não são fontes válidas",
    );
    expect(result.evidence).toEqual([]);
  });
  it("advertises and accepts only the owner-approved sources", () => {
    const allowed = [
      "compras_notas",
      "compras_itens",
      "vendas_produtos",
      "contas_pagar",
      "fichas_tecnicas",
      "inventarios",
    ];
    expect(approvedAssistantDatasets).toEqual(["financeiro", ...allowed]);
    for (const dataset of allowed)
      expect(
        parseInvestigationCall("consultar_kph", { dataset }, today).rpc,
      ).toBe("ghost_assistant_query_v4");
    for (const dataset of [
      "despesas",
      "dre_mensal",
      "dre_detalhes",
      "pessoas",
      "folha_resumo",
      "reservas",
      "eventos",
      "compras_pedidos",
      "caixas",
    ]) {
      expect(() =>
        parseInvestigationCall("consultar_kph", { dataset }, today),
      ).toThrow("assistant_source_not_allowed");
    }
    expect(
      approvedAssistantCatalog([
        { name: "despesas" },
        { name: "compras_itens" },
        { name: "dre_mensal" },
      ]),
    ).toEqual([{ name: "compras_itens" }]);
    expect(JSON.stringify(investigationTools)).not.toContain('"despesas"');
  });
  it("compares real purchases and discovers approved source dates", () => {
    expect(
      parseInvestigationCall(
        "comparar_kph",
        {
          dataset: "compras_itens",
          from: "2026-10-01",
          to: "2026-10-31",
          baselineFrom: "2026-09-01",
          baselineTo: "2026-09-30",
          search: "carne",
        },
        today,
      ),
    ).toMatchObject({
      rpc: "ghost_assistant_compare_v2",
      args: { p_dataset: "compras_itens", p_search: "carne" },
    });
    expect(
      parseInvestigationCall(
        "verificar_cobertura",
        { dataset: "inventarios" },
        today,
      ),
    ).toMatchObject({
      rpc: "ghost_assistant_coverage_v2",
      args: { p_dataset: "inventarios" },
    });
    expect(() =>
      parseInvestigationCall(
        "comparar_kph",
        {
          dataset: "despesas",
          from: "2026-10-01",
          to: "2026-10-31",
          baselineFrom: "2026-09-01",
          baselineTo: "2026-09-30",
        },
        today,
      ),
    ).toThrow();
  });
  it("corrects missing revenue described as no revenue", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(complete(call("analisar_financeiro", finance)))
      .mockResolvedValueOnce(final("No domingo, a casa ficou sem faturamento."))
      .mockResolvedValueOnce(final("No domingo não há registro disponível."));
    const result = await runInvestigation(input(), "", today, {
      model,
      query: async () => ({ summary: { incompleteDays: 1 } }),
    });
    expect(result.answer).toContain("registro disponível");
    expect(result.validationAttempts).toBe(2);
  });
  it("does not turn a null monthly revenue into a zero amount even if other fields contain zero", async () => {
    const model = vi
      .fn()
      .mockResolvedValueOnce(
        complete(call("analisar_financeiro", { ...finance, groupBy: "month" })),
      )
      .mockResolvedValueOnce(
        final("01/11: aparece com R$ 0,00 na visão mensal."),
      )
      .mockResolvedValueOnce(final("01/11: sem registro disponível."));
    const result = await runInvestigation(input(), "", today, {
      model,
      query: async () => ({
        from: finance.from,
        to: finance.to,
        rows: [{ month: "2026-11", reportedRevenue: null }],
        summary: { eventsRevenue: 0 },
      }),
    });
    expect(result.answer).not.toContain("R$ 0");
    expect(result.validationAttempts).toBe(2);
  });
  it("enforces ranges, allowlisted tools and typed boolean filters", () => {
    expect(() =>
      parseInvestigationCall("executar_sql", finance, today),
    ).toThrow();
    expect(() =>
      parseInvestigationCall(
        "analisar_financeiro",
        { ...finance, includeEvents: "false" },
        today,
      ),
    ).toThrow();
    expect(() =>
      parseInvestigationCall(
        "analisar_financeiro",
        { ...finance, from: "2026-01-01" },
        today,
      ),
    ).toThrow();
    expect(() =>
      parseInvestigationCall(
        "comparar_kph",
        {
          ...finance,
          dataset: "despesas",
          baselineFrom: "2026-02-30",
          baselineTo: "2026-03-01",
        },
        today,
      ),
    ).toThrow();
  });
  it("accepts the full previous answer, so a detailed response does not break the next turn", () => {
    expect(
      parseAssistantInput({
        ...input(),
        history: [{ role: "assistant", content: "A".repeat(6000) }],
      }).history[0]?.content,
    ).toHaveLength(6000);
  });
  it("provides business definitions and the current conversation state", () => {
    const prompt = investigationPrompt(input(), today);
    expect(prompt).toContain("2026-08-10");
    expect(prompt).toContain("Não complete dias ausentes com zero");
    expect(prompt).toContain("Meta mensal é monthGoal");
  });
});
