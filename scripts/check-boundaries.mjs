import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const source = [
  ...walk("app"),
  ...walk("src"),
  ".env.example",
  "app.config.ts",
  "eas.json",
];
const sourceSensitive =
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|service_role\s*[:=]/i;
for (const path of source) {
  const text = readFileSync(path).toString("utf8");
  if (sourceSensitive.test(text))
    throw new Error(`Possible administrative credential in ${path}`);
}
// Supabase JS itself contains the literal `sb_secret_` prefix to decide header
// semantics, so compiled bundles cannot use that marker as a secret detector.
// JWT-shaped values and explicit service-role assignments remain forbidden.
const bundleSensitive =
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|service_role\s*[:=]/i;
for (const path of walk("dist")) {
  const text = readFileSync(path).toString("utf8");
  if (bundleSensitive.test(text))
    throw new Error(`Possible administrative credential in ${path}`);
}
for (const path of source) {
  const text = readFileSync(path, "utf8");
  if (/\b(?:client|supabase|db)\.from\s*\(/.test(text))
    throw new Error(`Direct table access is forbidden in ${path}`);
}
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (!pkg.dependencies["@supabase/supabase-js"])
  throw new Error("Supabase client dependency missing");
if (existsSync(".env.local")) {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((value) => value.startsWith("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="));
  const configured = line?.slice(line.indexOf("=") + 1);
  if (configured && !configured.startsWith("sb_publishable_"))
    throw new Error("Local backend key is not a publishable key");
}
console.log(
  "PASS: no administrative secret/JWT; no direct table access; Supabase transport is RPC-only.",
);
