import type { ExpoConfig } from "expo/config";
const environment = process.env.EXPO_PUBLIC_APP_ENV ?? "local";
if (!["local", "preview", "production"].includes(environment))
  throw new Error("Ambiente inválido");
const dataMode = process.env.EXPO_PUBLIC_DATA_MODE ?? "mock";
if (!["mock", "remote"].includes(dataMode))
  throw new Error("EXPO_PUBLIC_DATA_MODE inválido.");
if (
  dataMode === "remote" &&
  (!process.env.EXPO_PUBLIC_SUPABASE_URL ||
    !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
)
  throw new Error("Backend remoto selecionado sem configuração pública.");
const suffix = environment === "production" ? "" : `.${environment}`;
const config: ExpoConfig = {
  name: `Ghost${environment === "production" ? "" : ` ${environment}`}`,
  slug: "ghost-mobile",
  version: "0.1.0",
  scheme: `ghost-${environment}`,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: { supportsTablet: true, bundleIdentifier: `app.ghost.demo${suffix}` },
  android: { package: `app.ghost.demo${suffix}` },
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
    easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  },
  updates: { enabled: false },
};
export default config;
