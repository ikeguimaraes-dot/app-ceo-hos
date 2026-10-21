import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import {
  createClient,
  type Session as SupabaseSession,
} from "@supabase/supabase-js";
import { z } from "zod";
import type {
  Bootstrap,
  Dashboard,
  Gateways,
  Notification,
  PendingItem,
  Session,
} from "../contracts/gateways";
import { backendConfig, environment } from "../config/environment";
import {
  getInstallationId,
  readInstallationId,
  secureSessionStorage,
  secureStorageKeys,
} from "../security/storage";

const capability = z.enum([
  "dashboard.read",
  "pending.read",
  "operation.read",
  "people.read",
  "notifications.read",
]);
const bootstrapSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(1),
  status: z.enum(["active", "unlinked", "inactive"]),
  accessVersion: z.string(),
  units: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      group: z.string(),
      brand: z.string(),
      capabilities: z.array(capability),
    }),
  ),
});
const dashboardSchema = z.object({
  updatedAt: z.string(),
  revenue: z.number().nullable(),
  goal: z.number().nullable(),
  goalProgress: z.number().nullable(),
  hasData: z.boolean(),
});
const pendingSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    detail: z.string(),
    priority: z.enum(["attention", "normal"]),
  }),
);
const notificationSchema = z.array(
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    body: z.string(),
    read: z.boolean(),
    target: z.enum(["/pending", "/"]),
  }),
);

function mapSession(session: SupabaseSession): Session {
  return {
    userId: session.user.id,
    displayName: "Usuário Ghost",
    expiresAt:
      (session.expires_at ?? Math.floor(Date.now() / 1000) + 60) * 1000,
  };
}

function friendlyError(error: { message: string; code?: string } | null) {
  if (!error) return new Error("Resposta inválida do servidor.");
  if (/invalid login credentials/i.test(error.message))
    return new Error("E-mail ou senha inválidos.");
  if (/fetch|network|offline/i.test(error.message))
    return new Error(
      "Sem conexão com o Ghost. Verifique sua internet e tente novamente.",
    );
  if (
    error.code === "42501" ||
    /capability_denied|permission denied/i.test(error.message)
  )
    return new Error("Acesso não permitido para esta unidade.");
  return new Error("Não foi possível concluir a operação.");
}

export function createRemoteGateways(): Gateways {
  const { url, publishableKey } = backendConfig();
  const client = createClient(url, publishableKey, {
    auth: {
      storage: secureSessionStorage,
      storageKey: secureStorageKeys.auth,
      autoRefreshToken: true,
      persistSession: Platform.OS !== "web",
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });

  async function rpc(
    name: string,
    args?: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const request = client.rpc(name, args);
    if (signal) request.abortSignal(signal);
    const { data, error } = await request;
    if (error) throw friendlyError(error);
    return data;
  }

  return {
    auth: {
      async restore() {
        const { data } = await client.auth.getSession();
        if (!data.session) return null;
        const { data: verified, error } = await client.auth.getUser();
        if (error || !verified.user) {
          await client.auth.signOut({ scope: "local" });
          return null;
        }
        return mapSession(data.session);
      },
      async signIn(email, password) {
        const { data, error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error || !data.session) throw friendlyError(error);
        return mapSession(data.session);
      },
      async recover(email) {
        const redirectTo = Linking.createURL("/auth/reset-password");
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo,
          },
        );
        if (error) throw friendlyError(error);
      },
      async completeRecovery(url) {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw friendlyError(error);
          return;
        }
        const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");
        if (!accessToken || !refreshToken)
          throw new Error("Link de recuperação inválido ou expirado.");
        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw friendlyError(error);
      },
      async updatePassword(password) {
        if (password.length < 10)
          throw new Error("Use uma senha com pelo menos 10 caracteres.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw friendlyError(error);
      },
      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw friendlyError(error);
      },
      onSessionChange(listener) {
        const { data } = client.auth.onAuthStateChange((_event, session) =>
          listener(session ? mapSession(session) : null),
        );
        return () => data.subscription.unsubscribe();
      },
      setAppActive(active) {
        if (Platform.OS === "web") return;
        if (active) client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      },
    },
    bootstrap: {
      async load() {
        return bootstrapSchema.parse(
          await rpc("ghost_bootstrap_v1"),
        ) satisfies Bootstrap;
      },
    },
    dashboard: {
      async get(scope) {
        const data = dashboardSchema.parse(
          await rpc(
            "ghost_dashboard_v1",
            {
              p_unit_id: scope.unitId,
              p_month: new Date().toISOString().slice(0, 10),
            },
            scope.signal,
          ),
        );
        return {
          ...data,
          summary: data.hasData
            ? "Dados consolidados pelo KPH."
            : "Nenhum fechamento disponível neste período.",
        } satisfies Dashboard;
      },
    },
    pending: {
      async list(scope) {
        return pendingSchema.parse(
          await rpc(
            "ghost_pending_items_v1",
            { p_unit_id: scope.unitId },
            scope.signal,
          ),
        ) satisfies PendingItem[];
      },
    },
    notifications: {
      async list(scope) {
        return notificationSchema.parse(
          await rpc(
            "ghost_notifications_v1",
            { p_unit_id: scope.unitId },
            scope.signal,
          ),
        ) satisfies Notification[];
      },
      async markRead(scope, id) {
        await rpc(
          "ghost_notification_mark_read_v1",
          { p_id: id, p_unit_id: scope.unitId },
          scope.signal,
        );
      },
      async register() {
        if (Platform.OS !== "ios" && Platform.OS !== "android")
          throw new Error("Push está disponível apenas em Android e iOS.");
        const current = await Notifications.getPermissionsAsync();
        const permission =
          current.status === "granted"
            ? current
            : await Notifications.requestPermissionsAsync();
        if (permission.status !== "granted")
          throw new Error("Permissão de notificações não concedida.");
        const projectId =
          Constants.easConfig?.projectId ??
          (Constants.expoConfig?.extra?.easProjectId as string | undefined);
        if (!projectId)
          throw new Error("Projeto EAS ainda não configurado para push.");
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        await rpc("ghost_register_installation_v1", {
          p_installation_id: await getInstallationId(),
          p_expo_token: token.data,
          p_platform: Platform.OS,
          p_app_environment: environment.appEnvironment,
          p_app_version: Constants.expoConfig?.version ?? "0.1.0",
        });
      },
      async unregister() {
        const installationId = await readInstallationId();
        if (installationId)
          await rpc("ghost_unregister_installation_v1", {
            p_installation_id: installationId,
          });
      },
    },
    simulation: {
      setMode() {},
      reset() {},
    },
  };
}

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
