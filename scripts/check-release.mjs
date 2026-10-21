import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const eas = JSON.parse(readFileSync("eas.json", "utf8"));
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const envExample = readFileSync(".env.example", "utf8");

function assert(value, message) {
  if (!value) throw new Error(message);
}

function expoConfig(appEnvironment, dataMode) {
  const output = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["expo", "config", "--type", "public", "--json"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_APP_ENV: appEnvironment,
        EXPO_PUBLIC_DATA_MODE: dataMode,
        EXPO_PUBLIC_SUPABASE_URL: "",
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
  );
  return JSON.parse(output);
}

const expected = [
  { name: "local", dataMode: "mock", suffix: ".local" },
  { name: "preview", dataMode: "remote", suffix: ".preview" },
  { name: "production", dataMode: "remote", suffix: "" },
];

for (const item of expected) {
  const config = expoConfig(item.name, item.dataMode);
  assert(
    config.scheme === `ghost-${item.name}`,
    `${item.name}: scheme inválido`,
  );
  assert(
    config.ios?.bundleIdentifier === `com.grupomeeteat.ghost${item.suffix}`,
    `${item.name}: bundleIdentifier inválido`,
  );
  assert(
    config.android?.package === `com.grupomeeteat.ghost${item.suffix}`,
    `${item.name}: package Android inválido`,
  );
  assert(
    config.updates?.enabled === false,
    `${item.name}: OTA deve estar desativado`,
  );
  assert(
    config.extra?.environment === item.name &&
      config.extra?.dataMode === item.dataMode,
    `${item.name}: extra público divergente`,
  );
  assert(
    !JSON.stringify(config.extra).match(/supabase|secret|service_role/i),
    `${item.name}: configuração pública contém campo sensível`,
  );
  assert(
    config.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false,
    `${item.name}: declaração de criptografia ausente`,
  );
}

assert(
  eas.cli?.appVersionSource === "remote",
  "EAS deve controlar a versão remota",
);
assert(
  eas.build?.preview?.distribution === "internal",
  "Preview deve ser interno",
);
assert(
  eas.build?.preview?.env?.EXPO_PUBLIC_APP_ENV === "preview" &&
    eas.build?.preview?.env?.EXPO_PUBLIC_DATA_MODE === "remote",
  "Perfil preview inválido",
);
assert(
  eas.build?.production?.env?.EXPO_PUBLIC_APP_ENV === "production" &&
    eas.build?.production?.env?.EXPO_PUBLIC_DATA_MODE === "remote",
  "Perfil production inválido",
);
assert(
  eas.build?.["preview-simulator"]?.ios?.simulator === true,
  "Preview de simulador iOS inválido",
);
assert(vercel.outputDirectory === "dist", "Vercel deve publicar somente dist");
assert(
  vercel.buildCommand === "npm run vercel-build",
  "Build Vercel inesperado",
);
assert(
  /EXPO_PUBLIC_SUPABASE_URL=\s*(?:\r?\n|$)/.test(envExample) &&
    /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\s*(?:\r?\n|$)/.test(envExample),
  ".env.example deve manter configuração remota vazia",
);

console.log(
  "PASS: ambientes, IDs nativos, perfis EAS, OTA, declaração iOS e publicação Vercel estão coerentes.",
);
