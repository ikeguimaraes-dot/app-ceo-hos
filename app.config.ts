import type { ExpoConfig } from "expo/config";
const environment = process.env.EXPO_PUBLIC_APP_ENV ?? "local";
if (!["local", "preview", "production"].includes(environment))
  throw new Error("Ambiente inválido");
const dataMode = process.env.EXPO_PUBLIC_DATA_MODE ?? "mock";
const easProjectId = "55db4818-fda5-4b05-ae7b-4114bb1c7e70";
if (!["mock", "remote"].includes(dataMode))
  throw new Error("EXPO_PUBLIC_DATA_MODE inválido.");
const suffix = environment === "production" ? "" : `.${environment}`;
const config: ExpoConfig = {
  name: `Ghost${environment === "production" ? "" : ` ${environment}`}`,
  slug: "ghost-mobile",
  version: "0.1.0",
  scheme: `ghost-${environment}`,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: `com.grupomeeteat.ghost${suffix}`,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: { package: `com.grupomeeteat.ghost${suffix}` },
  web: { bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Permitir que o Ghost use Face ID para desbloqueio local.",
      },
    ],
    ["expo-splash-screen", { backgroundColor: "#101A15" }],
  ],
  extra: {
    environment,
    dataMode,
    eas: { projectId: easProjectId },
  },
  updates: { enabled: false },
};
export default config;
