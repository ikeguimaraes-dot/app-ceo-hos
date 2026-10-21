export type AppEnvironment = "local" | "preview" | "production";
export type DataSource = "mock" | "remote";

const appEnvironment = (process.env.EXPO_PUBLIC_APP_ENV ??
  "local") as AppEnvironment;
const dataSource = (process.env.EXPO_PUBLIC_DATA_MODE ?? "mock") as DataSource;

if (!["local", "preview", "production"].includes(appEnvironment))
  throw new Error("EXPO_PUBLIC_APP_ENV inválido.");
if (!["mock", "remote"].includes(dataSource))
  throw new Error("EXPO_PUBLIC_DATA_MODE inválido.");

export const environment = {
  appEnvironment,
  dataSource,
  isRemote: dataSource === "remote",
};

export function backendConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey)
    throw new Error("Configuração pública do backend ausente.");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))
    throw new Error("URL pública do Supabase inválida.");
  if (!publishableKey.startsWith("sb_publishable_"))
    throw new Error(
      "Use uma publishable key; chaves administrativas são proibidas.",
    );
  return { url, publishableKey };
}
