import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readSavedLogin,
  saveLogin,
  secureStorage,
  secureSessionStorage,
  getInstallationId,
} from "../src/security/storage";
const { values, platform, failWrite } = vi.hoisted(() => ({
  values: new Map<string, string>(),
  platform: { OS: "ios" },
  failWrite: { value: false, at: "" },
}));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
  getItemAsync: vi.fn(async (key: string) => values.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string, options: unknown) => {
    expect(options).toEqual({ keychainAccessible: "device-only" });
    if (failWrite.value || key === failWrite.at)
      throw new Error("keychain unavailable");
    values.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    values.delete(key);
  }),
}));

describe("saved login on a personal device", () => {
  const login = {
    email: "demo@ghost.invalid",
    password: "fictional-demo-password",
  };
  beforeEach(() => {
    values.clear();
    platform.OS = "ios";
    failWrite.value = false;
    failWrite.at = "";
  });
  it("restores a selected login from device-only secure storage", async () => {
    await saveLogin(login);
    expect(await readSavedLogin()).toEqual(login);
  });
  it("removes saved credentials when the option is disabled", async () => {
    await saveLogin(login);
    await saveLogin(null);
    expect(await readSavedLogin()).toBeNull();
    expect(values.size).toBe(0);
  });
  it("logout removes both session and saved password, retaining only the installation identifier", async () => {
    const id = await getInstallationId();
    await secureSessionStorage.setItem(
      "ghost.auth.session",
      "fictional-session",
    );
    await saveLogin(login);
    await secureStorage.clear();
    expect(await readSavedLogin()).toBeNull();
    expect(await secureSessionStorage.getItem("ghost.auth.session")).toBeNull();
    expect(await getInstallationId()).toBe(id);
    expect(values.size).toBe(1);
  });
  it("never persists a password in a browser", async () => {
    platform.OS = "web";
    await saveLogin(login);
    expect(await readSavedLogin()).toBeNull();
    expect(values.size).toBe(0);
  });
  it("rejects corrupted credentials", async () => {
    await secureSessionStorage.setItem(
      "ghost.auth.saved-login",
      '{"email":42,"password":false}',
    );
    expect(await readSavedLogin()).toBeNull();
    expect(values.size).toBe(0);
  });
  it("removes all fragments when a multi-part secure write is interrupted", async () => {
    failWrite.at = "ghost.auth.saved-login.1";
    await expect(
      saveLogin({ ...login, password: "x".repeat(2500) }),
    ).rejects.toThrow();
    expect(values.size).toBe(0);
    expect(await readSavedLogin()).toBeNull();
  });
  it("reports a keychain failure without saving elsewhere", async () => {
    failWrite.value = true;
    await expect(saveLogin(login)).rejects.toThrow("keychain unavailable");
    expect(values.size).toBe(0);
  });
});
