import { describe, expect, it } from "vitest";
import {
  planAssistantQueries,
  type KphQueryToolInput,
} from "../supabase/functions/_shared/assistant";

const groups: {
  dataset: KphQueryToolInput["dataset"];
  questions: string[];
}[] = [
  {
    dataset: "financeiro",
    questions: [
      "Quanto faturamos hoje?",
      "Qual foi a receita ontem?",
      "Como está a meta este mês?",
      "Qual é o ticket médio?",
      "Quantos clientes tivemos?",
      "Compare as vendas das casas",
    ],
  },
  {
    dataset: "compras_itens",
    questions: [
      "Quanto comprei de carne este mês?",
      "Quanto compramos de peixe?",
      "Qual foi o gasto com bebidas?",
      "Quanto foi pago de proteína?",
      "Quanto comprei de hortifruti?",
      "Qual o gasto com café?",
      "Quando compramos de carne esse mes?",
    ],
  },
  {
    dataset: "despesas",
    questions: [
      "Qual foi a conta de luz?",
      "Quanto gastamos de energia?",
      "Qual foi a despesa com água?",
      "Quanto foi a conta de gás?",
      "Qual a despesa de telefone?",
      "Quanto gastamos com internet?",
      "Qual foi a despesa total deste mês?",
      "Quanto gastamos com marketing?",
    ],
  },
  {
    dataset: "dre_mensal",
    questions: [
      "Qual foi o EBITDA deste mês?",
      "Mostre o DRE realizado",
      "Qual foi o resultado líquido?",
      "Como está o prime cost?",
      "Qual é a margem operacional?",
      "Mostre o DRE orçado do Meet",
    ],
  },
  {
    dataset: "dre_detalhes",
    questions: [
      "Mostre os detalhes da DRE",
      "Quais são as linhas da DRE?",
      "Quero ver as contas da DRE",
      "Liste o detalhe da DRE deste mês",
      "Mostre as linhas do DRE do Meet",
      "Quais contas do DRE formam o resultado?",
    ],
  },
  {
    dataset: "conciliacao_pagamentos",
    questions: [
      "Como está a conciliação de pagamentos?",
      "Quantos pagamentos estão conciliados?",
      "Quantos turnos foram conciliados?",
      "Mostre a conciliação de pagamento do Meet",
      "Qual o total dos pagamentos conciliados?",
      "Compare a conciliação de pagamentos das casas",
    ],
  },
  {
    dataset: "contas_pagar",
    questions: [
      "Quais contas a pagar vencem hoje?",
      "Tem boletos vencidos?",
      "Quais contas estão vencidas?",
      "O que temos a vencer?",
      "Mostre os títulos a pagar",
      "Quanto há em boletos?",
    ],
  },
  {
    dataset: "compras_notas",
    questions: [
      "Quais notas fiscais chegaram?",
      "Liste as notas fiscais do mês",
      "Quero consultar uma nota fiscal",
      "Quais fornecedores emitiram notas?",
      "Mostre as NF de ontem",
      "Há nota fiscal do Meet?",
    ],
  },
  {
    dataset: "vendas_produtos",
    questions: [
      "Qual produto foi mais vendido?",
      "Mostre vendas por produto",
      "Quais produtos mais vendidos?",
      "Quanto de cada produto foi vendido?",
      "Produto com maior venda ontem",
      "Qual item foi mais vendido?",
    ],
  },
  {
    dataset: "pagamentos",
    questions: [
      "Quais formas de pagamento usamos?",
      "Quanto recebemos em Pix?",
      "Quanto entrou em dinheiro?",
      "Quanto foi pago em cartão?",
      "Compare formas de pagamento",
      "Pagamentos por forma ontem",
    ],
  },
  {
    dataset: "descontos",
    questions: [
      "Quanto demos de desconto?",
      "Liste os descontos",
      "Descontos de ontem",
      "Qual casa teve mais desconto?",
      "Motivos dos descontos",
      "Compare descontos das casas",
    ],
  },
  {
    dataset: "cancelamentos",
    questions: [
      "Quanto tivemos de cancelamentos?",
      "Liste os cancelamentos",
      "Itens cancelados ontem",
      "Qual casa teve mais cancelamentos?",
      "Motivos dos cancelamentos",
      "Compare cancelamentos das casas",
    ],
  },
  {
    dataset: "inventarios",
    questions: [
      "Como está o inventário?",
      "Mostre os inventários",
      "Qual o estoque contado?",
      "Há divergência de estoque?",
      "Inventário do Meet",
      "Últimos inventários",
    ],
  },
  {
    dataset: "contratos",
    questions: [
      "Quais contratos vencem?",
      "Liste os contratos",
      "Valor dos contratos",
      "Contratos ativos",
      "Próximo reajuste contratual",
      "Compare contratos das casas",
    ],
  },
  {
    dataset: "eventos",
    questions: [
      "Quais eventos teremos?",
      "Liste os eventos",
      "Valor dos eventos",
      "Eventos deste mês",
      "Quantos convidados nos eventos?",
      "Eventos do Meet",
    ],
  },
  {
    dataset: "reservas",
    questions: [
      "Quantas reservas temos?",
      "Liste as reservas",
      "Reservas de hoje",
      "Origem das reservas",
      "Compare reservas das casas",
      "Reservas canceladas",
    ],
  },
  {
    dataset: "folha_resumo",
    questions: [
      "Qual o custo da folha?",
      "Resumo da folha",
      "Quanto gastamos com salários?",
      "Folha por função",
      "Compare a folha das casas",
      "Salários deste mês",
    ],
  },
  {
    dataset: "manutencao",
    questions: [
      "Quais manutenções estão pendentes?",
      "Liste a manutenção",
      "Valor previsto de manutenção",
      "Manutenções urgentes",
      "Manutenção do Meet",
      "Compare manutenção das casas",
    ],
  },
  {
    dataset: "pessoas",
    questions: [
      "Quantas pessoas trabalham nas casas?",
      "Liste os funcionários",
      "Qual o headcount?",
      "Pessoas ativas",
      "Funcionários do Meet",
      "Compare pessoas das casas",
    ],
  },
  {
    dataset: "ausencias",
    questions: [
      "Quais ausências tivemos?",
      "Liste as faltas",
      "Ausências de hoje",
      "Quem teve ausência?",
      "Faltas deste mês",
      "Compare ausências das casas",
    ],
  },
  {
    dataset: "fichas_tecnicas",
    questions: [
      "Qual o custo da ficha técnica do risoto?",
      "Mostre as fichas técnicas",
      "Qual é o custo do prato executivo?",
      "Como está o custo teórico?",
      "Ficha técnica do hambúrguer",
      "Quais fichas técnicas têm custo?",
    ],
  },
  {
    dataset: "recebimentos",
    questions: [
      "Quantos recebimentos de mercadoria tivemos?",
      "Quais mercadorias recebidas chegaram hoje?",
      "Mostre os pedidos recebidos",
      "Houve entrega de fornecedor ontem?",
      "Liste as entregas de fornecedores",
      "Qual pedido recebido teve divergência?",
    ],
  },
  {
    dataset: "caixas",
    questions: [
      "Qual foi a diferença de caixa ontem?",
      "Mostre os fechamentos de caixa",
      "Tivemos quebra de caixa?",
      "Existem caixas abertos?",
      "Como foi o fechamento de caixa do Meet?",
      "Compare os fechamentos de caixa",
    ],
  },
];

describe("assistant routing evaluation", () => {
  const cases = groups.flatMap(({ dataset, questions }) =>
    questions.map((question) => ({ dataset, question })),
  );

  it("contains at least 100 representative executive questions", () => {
    expect(cases.length).toBeGreaterThanOrEqual(100);
  });

  it.each(cases)("routes $question to $dataset", ({ dataset, question }) => {
    expect(
      planAssistantQueries(question, "2026-10-23", [
        "Meet & Eat",
        "Frêneze",
        "Madonna SP Itaim",
        "Match Point",
      ])?.[0]?.dataset,
    ).toBe(dataset);
  });
});
