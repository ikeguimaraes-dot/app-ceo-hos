import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const envText = await readFile(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const client = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const protectedRpcs = [
  ["ghost_bootstrap_v1"],
  ["ghost_notification_preferences_v1"],
  ["ghost_internal_push_claim_v1"],
  [
    "ghost_reconcile_installation_v1",
    {
      p_installation_id: "00000000-0000-0000-0000-000000000000",
      p_expo_token: "ExponentPushToken[anonymous-negative-test]",
      p_platform: "ios",
      p_app_environment: "preview",
      p_app_version: "0.1.0",
    },
  ],
  [
    "ghost_internal_operation_log_v1",
    {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_operation: "push.worker",
      p_outcome: "success",
      p_code: "ok",
      p_duration_ms: 1,
      p_claimed_count: 0,
      p_receipt_count: 0,
    },
  ],
  [
    "ghost_pending_items_v2",
    { p_unit_id: "00000000-0000-0000-0000-000000000000" },
  ],
  [
    "ghost_notifications_v2",
    { p_unit_id: "00000000-0000-0000-0000-000000000000" },
  ],
  [
    "ghost_operation_summary_v1",
    { p_unit_id: "00000000-0000-0000-0000-000000000000" },
  ],
  [
    "ghost_people_summary_v1",
    { p_unit_id: "00000000-0000-0000-0000-000000000000" },
  ],
  [
    "ghost_decide_pending_v1",
    {
      p_unit_id: "00000000-0000-0000-0000-000000000000",
      p_item_id: "maintenance:00000000-0000-0000-0000-000000000000",
      p_decision: "approve",
      p_reason: null,
      p_expected_version: "00000000000000000000000000000000",
      p_idempotency_key: "ghost-negative-anonymous",
    },
  ],
  [
    "ghost_assistant_begin_v1",
    {
      p_unit_id: "00000000-0000-0000-0000-000000000000",
      p_request_id: "00000000-0000-0000-0000-000000000000",
    },
  ],
  [
    "ghost_assistant_finish_v1",
    {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_outcome: "error",
      p_code: "negative_test",
      p_model: "negative-test",
      p_prompt_tokens: 0,
      p_completion_tokens: 0,
    },
  ],
  [
    "ghost_assistant_finish_v2",
    {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_outcome: "error",
      p_code: "negative_test",
      p_model: "negative-test",
      p_prompt_tokens: 0,
      p_completion_tokens: 0,
      p_datasets: [],
      p_tool_call_count: 0,
      p_validation_attempts: 0,
      p_latency_ms: 1,
    },
  ],
  [
    "ghost_assistant_feedback_v1",
    {
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_helpful: true,
    },
  ],
  ["ghost_assistant_finance_v1", { p_from: "2026-10-21", p_to: "2026-10-21" }],
  ["ghost_assistant_catalog_v1"],
  ["ghost_assistant_catalog_v2"],
  ["ghost_assistant_catalog_v3"],
  ["ghost_assistant_quality_v1", { p_days: 7 }],
  [
    "ghost_dashboard_v2",
    {
      p_unit_id: "00000000-0000-0000-0000-000000000000",
      p_month: "2026-10-01",
    },
  ],
  [
    "ghost_dashboard_v3",
    {
      p_unit_id: "00000000-0000-0000-0000-000000000000",
      p_month: "2026-10-01",
    },
  ],
  [
    "ghost_payables_v1",
    {
      p_unit_id: "00000000-0000-0000-0000-000000000000",
      p_as_of: "2026-10-22",
      p_limit: 20,
    },
  ],
  [
    "ghost_cash_flow_week_v1",
    {
      p_unit_id: "00000000-0000-0000-0000-000000000000",
      p_week_offset: 0,
    },
  ],
  [
    "ghost_payables_v2",
    {
      p_unit_id: null,
      p_status: "open",
      p_as_of: "2026-10-22",
      p_limit: 20,
    },
  ],
  [
    "ghost_cash_flow_week_v2",
    {
      p_unit_id: null,
      p_week_offset: 0,
    },
  ],
  [
    "ghost_product_invoices_v1",
    {
      p_unit_id: "00000000-0000-0000-0000-000000000000",
      p_month: "2026-10-01",
      p_limit: 20,
    },
  ],
  [
    "ghost_assistant_query_v1",
    {
      p_dataset: "financeiro",
      p_from: "2026-10-21",
      p_to: "2026-10-21",
      p_unit: null,
      p_search: null,
      p_grain: "day",
      p_limit: 20,
    },
  ],
  [
    "ghost_assistant_query_v2",
    {
      p_dataset: "financeiro",
      p_from: "2026-10-21",
      p_to: "2026-10-21",
      p_unit: null,
      p_search: null,
      p_grain: "day",
      p_limit: 20,
    },
  ],
  [
    "ghost_assistant_query_v3",
    {
      p_dataset: "caixas",
      p_from: "2026-10-21",
      p_to: "2026-10-21",
      p_unit: null,
      p_search: null,
      p_grain: "day",
      p_limit: 20,
    },
  ],
  [
    "ghost_assistant_query_v4",
    {
      p_dataset: "conciliacao_pagamentos",
      p_from: "2026-10-01",
      p_to: "2026-10-21",
      p_unit: null,
      p_search: null,
      p_grain: "month",
      p_limit: 20,
    },
  ],
];
for (const [rpc, args] of protectedRpcs) {
  const anonymousRpc = await client.rpc(rpc, args);
  if (!anonymousRpc.error)
    throw new Error(`${rpc} anônima deveria ser negada.`);
}
const invalidLogin = await client.auth.signInWithPassword({
  email: "ghost.invalid-login@example.invalid",
  password: "invalid-password-never-use",
});
if (!invalidLogin.error || invalidLogin.data.session)
  throw new Error("Credenciais inválidas deveriam ser recusadas.");
process.stdout.write(
  JSON.stringify({
    publicEndpoint: true,
    anonymousRpcsDenied: protectedRpcs.length,
    invalidCredentialsDenied: true,
  }),
);
