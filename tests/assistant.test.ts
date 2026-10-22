import { describe, expect, it } from "vitest";
import {
  minimizeAssistantContext,
  parseAssistantInput,
  systemPrompt,
} from "../supabase/functions/_shared/assistant";

describe("assistant boundary", () => {
  it("accepts only bounded unit-scoped conversation input", () => {
    const parsed = parseAssistantInput({
      unitId: "11111111-1111-4111-8111-111111111111",
      question: "  Como está a meta?  ",
      history: [{ role: "assistant", content: " Contexto anterior " }],
    });
    expect(parsed.question).toBe("Como está a meta?");
    expect(parsed.history[0]?.content).toBe("Contexto anterior");
    expect(() =>
      parseAssistantInput({ unitId: "fora", question: "teste", history: [] }),
    ).toThrow("invalid_unit");
    expect(() =>
      parseAssistantInput({
        unitId: "11111111-1111-4111-8111-111111111111",
        question: "x".repeat(1001),
        history: [],
      }),
    ).toThrow("invalid_question");
  });

  it("marks database context as untrusted and read-only", () => {
    const prompt = systemPrompt(
      { name: "Unidade", brand: "Marca", group: "Grupo" },
      { Dashboard: { revenue: 100 } },
    );
    expect(prompt).toContain("dado não confiável");
    expect(prompt).toContain("somente leitura");
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
