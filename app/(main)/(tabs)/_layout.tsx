import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/ui/theme";
import { useGhost } from "../../../src/state/provider";
export default function TabLayout() {
  const { colors } = useTheme();
  const { controller } = useGhost();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="grid-outline"
              size={size}
              color={typeof color === "string" ? color : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pending"
        options={{
          title: "Pendências",
          href: controller.can("pending.read") ? "/pending" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="checkbox-outline"
              size={size}
              color={typeof color === "string" ? color : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "IA",
          href: controller.canAny("assistant.ask") ? "/assistant" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={size}
              color={typeof color === "string" ? color : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="operation"
        options={{
          title: "Operação",
          href: controller.can("operation.read") ? "/operation" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="layers-outline"
              size={size}
              color={typeof color === "string" ? color : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "Pessoas",
          href: controller.can("people.read") ? "/people" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="people-outline"
              size={size}
              color={typeof color === "string" ? color : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Mais",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="ellipsis-horizontal"
              size={size}
              color={typeof color === "string" ? color : colors.muted}
            />
          ),
        }}
      />
    </Tabs>
  );
}
