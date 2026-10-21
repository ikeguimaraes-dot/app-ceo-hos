import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, Platform } from "react-native";
import { router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMockGateways } from "../data/mock-gateways";
import { createRemoteGateways } from "../data/remote-gateways";
import { environment } from "../config/environment";
import { secureStorage } from "../security/storage";
import { Controller } from "./controller";
import { pushDestination } from "../notifications/navigation";
const Context = createContext<Controller | null>(null);
export function AppProvider({ children }: React.PropsWithChildren) {
  const [controller] = useState(
    () =>
      new Controller(
        environment.isRemote ? createRemoteGateways() : createMockGateways(),
        new QueryClient({
          defaultOptions: {
            queries: {
              retry: false,
              staleTime: 30_000,
              gcTime: 300_000,
              refetchOnWindowFocus: false,
            },
          },
        }),
        secureStorage,
      ),
  );
  useEffect(() => {
    void controller.start();
    controller.gateways.auth.setAppActive?.(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (state) => {
      controller.gateways.auth.setAppActive?.(state === "active");
      if (state !== "active") controller.lock();
      else void controller.revalidateAccess();
    });
    return () => subscription.remove();
  }, [controller]);
  useEffect(() => {
    const timer = setInterval(() => void controller.revalidateAccess(), 60_000);
    return () => clearInterval(timer);
  }, [controller]);
  useEffect(() => {
    return controller.gateways.auth.onSessionChange?.((session) => {
      if (
        session &&
        controller.state.session?.userId === session.userId &&
        controller.state.status === "ready"
      )
        controller.refreshSession(session);
      else if (!session && controller.state.session)
        void controller.logout(true);
    });
  }, [controller]);
  useEffect(() => {
    const timer = setInterval(() => {
      const { session, status } = controller.state;
      if (session && status === "ready" && session.expiresAt <= Date.now())
        void controller.logout(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [controller]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    let remove: (() => void) | undefined;
    const handled = new Set<string>();
    const open = (response: {
      notification: {
        request: { identifier: string; content: { data?: unknown } };
      };
    }) => {
      const request = response.notification.request;
      if (handled.has(request.identifier)) return;
      handled.add(request.identifier);
      const target = pushDestination(request.content.data);
      const { status, unitId } = controller.state;
      if (status === "ready" && unitId) router.push(target);
      else if (status === "ready")
        router.push({ pathname: "/units", params: { next: target } });
      else router.push({ pathname: "/login", params: { next: target } });
    };
    void import("expo-notifications").then(async (Notifications) => {
      if (!active) return;
      const subscription =
        Notifications.addNotificationResponseReceivedListener(open);
      remove = () => subscription.remove();
      const response = await Notifications.getLastNotificationResponseAsync();
      if (active && response) open(response);
    });
    return () => {
      active = false;
      remove?.();
    };
  }, [controller]);
  return (
    <Context.Provider value={controller}>
      <QueryClientProvider client={controller.queries}>
        {children}
      </QueryClientProvider>
    </Context.Provider>
  );
}
export function useGhost() {
  const controller = useContext(Context);
  if (!controller) throw new Error("AppProvider ausente");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  return { controller, state, gateways: controller.gateways };
}
