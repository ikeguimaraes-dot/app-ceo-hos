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
        "maintenance.decide",
        "punch.decide",
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
      kind: "maintenance" as const,
      title: "Revisar fechamento",
      detail: "Conferência simulada • nenhuma ação financeira será executada",
      priority: "attention" as const,
      version: "demo-review-v1",
      canDecide: true,
    },
    {
      id: "demo-document",
      kind: "punch" as const,
      title: "Conferir documento",
      detail: "Documento fictício disponível para revisão",
      priority: "normal" as const,
      version: "demo-document-v1",
      canDecide: true,
    },
  ],
  operation: {
    updatedAt: "2026-10-20T12:00:00Z",
    pendingMaintenance: 3,
    attentionMaintenance: 1,
    oldestPendingDate: "2026-10-18",
  },
  people: {
    updatedAt: "2026-10-20T12:00:00Z",
    headcount: 42,
    pendingPunchAdjustments: 2,
  },
  notifications: [
    {
      id: "demo-alert",
      title: "Um fechamento espera por você",
      body: "Aviso de demonstração. Toque para consultar as pendências.",
      read: false,
      target: "/pending" as const,
      createdAt: "2026-10-20T12:00:00Z",
    },
  ],
};
