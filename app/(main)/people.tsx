import { Stack } from "expo-router";
import { ModuleScreen } from "../../src/features/screens";
import { useTheme } from "../../src/ui/theme";
export default function PeopleRoute() {
  const { colors } = useTheme();
  return <><Stack.Screen options={{ headerShown: true, title: "Pessoas", headerBackTitle: "Mais", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} /><ModuleScreen kind="people" /></>;
}
