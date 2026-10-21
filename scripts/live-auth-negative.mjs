import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const envText = await readFile(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const client = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const anonymousRpc = await client.rpc("ghost_bootstrap_v1");
if (!anonymousRpc.error) throw new Error("Bootstrap anônimo deveria ser negado.");
const invalidLogin = await client.auth.signInWithPassword({
  email: "ghost.invalid-login@example.invalid",
  password: "invalid-password-never-use",
});
if (!invalidLogin.error || invalidLogin.data.session)
  throw new Error("Credenciais inválidas deveriam ser recusadas.");
process.stdout.write(
  JSON.stringify({
    publicEndpoint: true,
    anonymousRpcDenied: true,
    invalidCredentialsDenied: true,
  }),
);
