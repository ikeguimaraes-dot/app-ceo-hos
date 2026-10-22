import React, { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(value: string, long = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: long ? "long" : "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${value.slice(0, 7)}-15T12:00:00-03:00`));
}

export function MonthSelector({ value, onChange, months = 13 }: { value: string; onChange: (month: string) => void; months?: number }) {
  const { colors } = useTheme();
  const options = useMemo(() => {
    const now = new Date();
    return Array.from({ length: months }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    });
  }, [months]);
  return (
    <View accessibilityRole="tablist" style={{ gap: 9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons name="calendar-clear-outline" size={15} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 }}>PERÍODO</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((month) => {
          const active = month.slice(0, 7) === value.slice(0, 7);
          return (
            <Pressable key={month} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={monthLabel(month, true)} onPress={() => onChange(month)} style={({ pressed }) => ({ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, backgroundColor: active ? colors.accent : colors.surface, borderWidth: 1, borderColor: active ? colors.accent : colors.line, opacity: pressed ? 0.72 : 1 })}>
              <Text style={{ color: active ? "#FFFFFF" : colors.text, fontWeight: "700", fontSize: 12, textTransform: "capitalize" }}>{monthLabel(month)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
