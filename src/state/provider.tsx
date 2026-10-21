import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMockGateways } from "../data/mock-gateways";
import { createRemoteGateways } from "../data/remote-gateways";
import { environment } from "../config/environment";
import { secureStorage } from "../security/storage";
import { Controller } from "./controller";
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
    });
    return () => subscription.remove();
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
