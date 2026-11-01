import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
export interface LocalStorage {
  clear(): Promise<void>;
}
const authKey = "ghost.auth.session";
const installationKey = "ghost.installation.id";
const assistantModelKey = "ghost.assistant.model";
const savedLoginKey = "ghost.auth.saved-login";
const chunkSize = 1800;
const webMemory = new Map<string, string>();

// SecureStore accepts only alphanumeric characters plus `.`, `-` and `_`.
// Keep this separator centralized so the Supabase storage adapter never
// generates a native-only invalid key.
const partKey = (key: string, part: "count" | number) => `${key}.${part}`;

async function removeChunks(key: string) {
  if (Platform.OS === "web") {
    webMemory.delete(key);
    return;
  }
  const rawCount = await SecureStore.getItemAsync(partKey(key, "count"));
  const count = Number(rawCount ?? "0");
  await Promise.all([
    SecureStore.deleteItemAsync(key),
    SecureStore.deleteItemAsync(partKey(key, "count")),
    ...Array.from({ length: Number.isFinite(count) ? count : 0 }, (_, index) =>
      SecureStore.deleteItemAsync(partKey(key, index)),
    ),
  ]);
}

export const secureSessionStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return webMemory.get(key) ?? null;
    const rawCount = await SecureStore.getItemAsync(partKey(key, "count"));
    if (!rawCount) return SecureStore.getItemAsync(key);
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > 20) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(partKey(key, index)),
      ),
    );
    return chunks.every((value): value is string => value !== null)
      ? chunks.join("")
      : null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      webMemory.set(key, value);
      return;
    }
    await removeChunks(key);
    const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, "gs")) ?? [""];
    try {
      const writes = await Promise.allSettled(
        chunks.map((chunk, index) =>
          SecureStore.setItemAsync(partKey(key, index), chunk, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        ),
      );
      const failed = writes.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      await SecureStore.setItemAsync(
        partKey(key, "count"),
        String(chunks.length),
        {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        },
      );
    } catch (error) {
      // An interrupted write must not leave password/session fragments without
      // a count marker that logout would be unable to discover.
      await Promise.allSettled([
        ...chunks.map((_, index) =>
          SecureStore.deleteItemAsync(partKey(key, index)),
        ),
        SecureStore.deleteItemAsync(partKey(key, "count")),
        SecureStore.deleteItemAsync(key),
      ]);
      throw error;
    }
  },
  removeItem: removeChunks,
};

export async function readInstallationId() {
  return Platform.OS === "web"
    ? (webMemory.get(installationKey) ?? null)
    : SecureStore.getItemAsync(installationKey);
}

export async function getInstallationId() {
  const current = await readInstallationId();
  if (current) return current;
  const id = globalThis.crypto.randomUUID();
  if (Platform.OS === "web") webMemory.set(installationKey, id);
  else
    await SecureStore.setItemAsync(installationKey, id, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  return id;
}

export async function readAssistantModel(userId: string) {
  return secureSessionStorage.getItem(`${assistantModelKey}.${userId}`);
}

export async function writeAssistantModel(userId: string, modelId: string) {
  await secureSessionStorage.setItem(`${assistantModelKey}.${userId}`, modelId);
}

export const secureStorage: LocalStorage = {
  async clear() {
    // The installation identifier belongs to this app installation, not to an
    // account. Keeping it across logout lets the backend atomically hand a
    // shared device to the next authenticated user and retire stale bindings.
    await Promise.all([removeChunks(authKey), removeChunks(savedLoginKey)]);
  },
};

export async function readSavedLogin(): Promise<{
  email: string;
  password: string;
} | null> {
  if (Platform.OS === "web") return null;
  const raw = await secureSessionStorage.getItem(savedLoginKey);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "email" in value &&
      "password" in value &&
      typeof value.email === "string" &&
      typeof value.password === "string" &&
      value.email.length > 0 &&
      value.password.length > 0
    )
      return { email: value.email, password: value.password };
  } catch {
    /* Invalid local data is discarded, never used for authentication. */
  }
  await removeChunks(savedLoginKey);
  return null;
}

export async function saveLogin(
  value: { email: string; password: string } | null,
) {
  if (Platform.OS === "web") return;
  if (!value) return removeChunks(savedLoginKey);
  await secureSessionStorage.setItem(savedLoginKey, JSON.stringify(value));
}

export const secureStorageKeys = { auth: authKey };
