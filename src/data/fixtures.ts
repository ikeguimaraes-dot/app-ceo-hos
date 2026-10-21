import type { Unit } from "../contracts/gateways";
// All demo business data lives here. These are fictional organizations and values.
export const demo = {
  displayName: "Alex • demonstração",
  units: [
    {
      id: "demo-garden",
      name: "Jardim · Demo",
      group: "Grupo Demonstração",
      brand: "Ghost Labs",
      capabilities: [
        "dashboard.read",
        "pending.read",
        "operation.read",
        "people.read",
        "notifications.read",
      ],
    },
    {
      id: "demo-coast",
      name: "Costa · Demo",
      group: "Grupo Demonstração",
      brand: "Ghost Labs",
      capabilities: ["dashboard.read", "pending.read", "notifications.read"],
    },
  ] satisfies Unit[],
  dashboards: {
    "demo-garden": {
      updatedAt: "2026-10-20T12:00:00Z",
      revenue: 24850,
      goal: 30304.88,
      goalProgress: 0.82,
      hasData: true,
      summary: "Um dia para acompanhar de perto.",
    },
    "demo-coast": {
      updatedAt: "2026-10-20T12:00:00Z",
      revenue: 18320,
      goal: 24756.76,
      goalProgress: 0.74,
      hasData: true,
      summary: "Sua operação, em perspectiva.",
    },
  },
  pending: [
    {
      id: "demo-review",
      title: "Revisar fechamento",
      detail: "Conferência simulada • nenhuma ação financeira será executada",
      priority: "attention" as const,
    },
    {
      id: "demo-document",
      title: "Conferir documento",
      detail: "Documento fictício disponível para revisão",
      priority: "normal" as const,
    },
  ],
  notifications: [
    {
      id: "demo-alert",
      title: "Um fechamento espera por você",
      body: "Aviso de demonstração. Toque para consultar as pendências.",
      read: false,
      target: "/pending" as const,
    },
  ],
};
