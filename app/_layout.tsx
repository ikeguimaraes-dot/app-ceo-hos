import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AppProvider, useGhost } from "../src/state/provider";
import { ThemeProvider, useTheme } from "../src/ui/theme";
import { Loading, Screen } from "../src/ui/components";
void SplashScreen.preventAutoHideAsync().catch(() => {});
function Routes() {
  const { state } = useGhost();
  const { dark, colors } = useTheme();
  useEffect(() => {
    if (state.status !== "starting") void SplashScreen.hideAsync();
  }, [state.status]);
  if (state.status === "starting")
    return (
      <Screen title="Preparando sua visão.">
        <Loading />
      </Screen>
    );
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </>
  );
}
export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Routes />
      </AppProvider>
    </ThemeProvider>
  );
}
