import { describe, expect, it } from "vitest";
import {
  chunks,
  constantTimeEqual,
  expoMessage,
  receiptResult,
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
});
