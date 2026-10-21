export type ClaimedDelivery = {
  deliveryId: string;
  token: string;
  title: string;
  body: string;
  target: "/" | "/pending" | "/notifications";
  eventId: string;
  category: "pending" | "operation" | "people" | "system";
};

export type ClaimedReceipt = { deliveryId: string; ticketId: string };
export type PushResult = {
  deliveryId: string;
  status: "sent" | "accepted" | "retry" | "failed";
  ticketId?: string;
  errorCode?: string;
};

type ExpoResponse = {
  status?: string;
  id?: string;
  details?: { error?: string };
};

const retryable = new Set(["MessageRateExceeded", "ExpoServerError"]);

export function chunks<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1)
    throw new Error("invalid_chunk_size");
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}

export function expoMessage(item: ClaimedDelivery) {
  return {
    to: item.token,
    title: item.title,
    body: item.body,
    sound: "default",
    data: {
      version: 1,
      eventId: item.eventId,
      category: item.category,
      target: item.target,
    },
  };
}

export function ticketResult(
  item: ClaimedDelivery,
  ticket: ExpoResponse | undefined,
): PushResult {
  if (ticket?.status === "ok" && ticket.id)
    return { deliveryId: item.deliveryId, status: "sent", ticketId: ticket.id };
  const errorCode = ticket?.details?.error ?? "InvalidProviderResponse";
  return {
    deliveryId: item.deliveryId,
    status: retryable.has(errorCode) ? "retry" : "failed",
    errorCode,
  };
}

export function receiptResult(
  item: ClaimedReceipt,
  receipt: ExpoResponse | undefined,
): PushResult {
  if (receipt?.status === "ok")
    return { deliveryId: item.deliveryId, status: "accepted" };
  const errorCode = receipt?.details?.error ?? "ReceiptUnavailable";
  return {
    deliveryId: item.deliveryId,
    status:
      retryable.has(errorCode) || errorCode === "ReceiptUnavailable"
        ? "retry"
        : "failed",
    errorCode,
  };
}

export function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1)
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}
