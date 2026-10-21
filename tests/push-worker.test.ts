import { describe, expect, it } from "vitest";
import {
  chunks,
  constantTimeEqual,
  expoMessage,
  operationLog,
  requestId,
  receiptResult,
  stableErrorCode,
  ticketResult,
  type ClaimedDelivery,
} from "../supabase/functions/_shared/push";

const delivery: ClaimedDelivery = {
  deliveryId: "delivery-1",
  token: "ExponentPushToken[example]",
  title: "Ghost",
  body: "Você tem uma nova atualização.",
  target: "/pending",
  eventId: "event-1",
  category: "pending",
};

describe("push worker boundaries", () => {
  it("creates a generic payload with an allowlisted target", () => {
    expect(expoMessage(delivery)).toEqual({
      to: delivery.token,
      title: "Ghost",
      body: "Você tem uma nova atualização.",
      sound: "default",
      data: {
        version: 1,
        eventId: "event-1",
        category: "pending",
        target: "/pending",
      },
    });
  });

  it("maps tickets and permanent token failures", () => {
    expect(ticketResult(delivery, { status: "ok", id: "ticket-1" })).toEqual({
      deliveryId: "delivery-1",
      status: "sent",
      ticketId: "ticket-1",
    });
    expect(
      ticketResult(delivery, {
        status: "error",
        details: { error: "DeviceNotRegistered" },
      }),
    ).toMatchObject({ status: "failed", errorCode: "DeviceNotRegistered" });
  });

  it("retries unavailable receipts and chunks provider batches", () => {
    expect(
      receiptResult(
        { deliveryId: "delivery-1", ticketId: "ticket-1" },
        undefined,
      ),
    ).toMatchObject({ status: "retry", errorCode: "ReceiptUnavailable" });
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("compares worker secrets without early exit", () => {
    expect(constantTimeEqual("same", "same")).toBe(true);
    expect(constantTimeEqual("same", "different")).toBe(false);
  });

  it("emits bounded observability fields without payload data", () => {
    const id = "0199f0c0-6a2d-7a11-8dd0-0123456789ab";
    expect(requestId(id.toUpperCase(), () => "fallback")).toBe(id);
    expect(requestId("not-an-id", () => id)).toBe(id);
    expect(stableErrorCode(new Error("claim_failed:42501"))).toBe(
      "claim_failed",
    );
    expect(stableErrorCode(new Error("unsafe value with spaces"))).toBe(
      "worker_failed",
    );
    expect(operationLog(id, "error", "claim_failed", 12.6)).toEqual({
      requestId: id,
      operation: "push.worker",
      outcome: "error",
      code: "claim_failed",
      durationMs: 13,
    });
  });
});
