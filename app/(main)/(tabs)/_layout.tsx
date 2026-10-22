import { useEffect, useState } from "react";
import { Animated, Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/ui/theme";
import { useGhost } from "../../../src/state/provider";

type TabIconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ focused, active, inactive }: { focused: boolean; active: TabIconName; inactive: TabIconName }) {
  const { colors } = useTheme();
  const [scale] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0,
      damping: 15,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View
      style={{
        width: 36,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.neon,
        shadowOpacity: focused ? 0.5 : 0,
        shadowRadius: focused ? 8 : 0,
        shadowOffset: { width: 0, height: 1 },
        elevation: focused ? 5 : 0,
        transform: [
          { translateY: scale.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
          { scale: scale.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
        ],
      }}
    >
      {focused ? <Animated.View style={{ position: "absolute", width: 30, height: 30, borderRadius: 15, backgroundColor: `${colors.neon}18`, opacity: scale }} /> : null}
      <Ionicons name={focused ? active : inactive} size={focused ? 26 : 22} color={focused ? colors.neon : colors.muted} />
    </Animated.View>
  );
}

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
          backgroundColor: colors.elevated,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 8 : 7,
          shadowColor: "#000000",
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -6 },
          elevation: 16,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 1 },
        tabBarItemStyle: { borderRadius: 16 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="grid" inactive="grid-outline" />,
        }}
      />
      <Tabs.Screen
        name="pending"
        options={{
          title: "A pagar",
          href: controller.can("dashboard.read") ? "/pending" : null,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="wallet" inactive="wallet-outline" />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "IA",
          href: controller.canAny("assistant.ask") ? "/assistant" : null,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="chatbubble-ellipses" inactive="chatbubble-ellipses-outline" />,
        }}
      />
      <Tabs.Screen
        name="operation"
        options={{
          title: "NF",
          href: controller.can("operation.read") ? "/operation" : null,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="receipt" inactive="receipt-outline" />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "Pessoas",
          href: controller.can("people.read") ? "/people" : null,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="people" inactive="people-outline" />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Mais",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} active="ellipsis-horizontal-circle" inactive="ellipsis-horizontal" />,
        }}
      />
    </Tabs>
  );
}
