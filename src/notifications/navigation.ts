import { safeDestination } from "../state/controller";

export function pushDestination(data: unknown) {
  if (!data || typeof data !== "object") return "/" as const;
  const payload = data as Record<string, unknown>;
  if (payload.version !== 1 || typeof payload.target !== "string")
    return "/" as const;
  return safeDestination(payload.target);
}
