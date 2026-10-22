import { useEffect, useMemo, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useGhost } from "../state/provider";
import { Empty, ErrorState, Loading } from "../ui/components";
import { useTheme } from "../ui/theme";
import type { PayableItem } from "../contracts/gateways";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function Reveal({ children, delay = 0 }: React.PropsWithChildren<{ delay?: number }>) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 430, delay, useNativeDriver: true }).start();
  }, [delay, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>{children}</Animated.View>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 145, padding: 17, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 7 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tone }} />
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.7 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.7 }}>{money.format(value)}</Text>
    </View>
  );
}

function PayableRow({ item, index }: { item: PayableItem; index: number }) {
  const { colors } = useTheme();
  const overdue = item.status === "overdue";
  const today = item.status === "due_today";
  const tone = overdue ? colors.danger : today ? colors.warning : colors.neon;
  const status = overdue ? `${item.daysOverdue}d em atraso` : today ? "Vence hoje" : "Próximo vencimento";
  return (
    <Reveal delay={80 + index * 45}>
      <View style={{ flexDirection: "row", gap: 13, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <View style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: `${tone}18`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={overdue ? "alert-circle-outline" : "receipt-outline"} size={21} color={tone} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" }}>{item.supplier}</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{money.format(item.amount)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.document}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Text style={{ color: tone, fontSize: 11, fontWeight: "700" }}>{status}</Text>
            {item.dueDate && <Text style={{ color: colors.muted, fontSize: 11 }}>· {new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</Text>}
          </View>
        </View>
      </View>
    </Reveal>
  );
}

export function PayablesExperience() {
  const { state, controller, gateways } = useGhost();
  const { colors } = useTheme();
  const session = state.session;
  const unitId = state.unitId;
  const units = useMemo(() => (state.bootstrap?.units ?? []).filter((unit) => unit.capabilities.includes("dashboard.read")), [state.bootstrap?.units]);
  const current = units.find((unit) => unit.id === unitId);
  const query = useQuery({
    queryKey: ["payables", session?.userId, unitId, state.generation],
    queryFn: ({ signal }) => gateways.payables.get({ session: session!, unitId: unitId!, signal }),
    enabled: !!session && !!unitId,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View pointerEvents="none" style={{ position: "absolute", top: -110, right: -100, width: 280, height: 280, borderRadius: 140, backgroundColor: colors.auroraTwo, opacity: 0.26 }} />
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", padding: 22, paddingBottom: 55, gap: 20 }} showsVerticalScrollIndicator={false}>
        <Reveal>
          <View style={{ gap: 7 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name="wallet-outline" color={colors.neon} size={22} /><Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>FINANCEIRO</Text></View>
            <Text style={{ color: colors.text, fontSize: 37, lineHeight: 41, fontWeight: "800", letterSpacing: -1.5 }}>Contas a pagar</Text>
            <Text style={{ color: colors.muted, fontSize: 14 }}>Visão de caixa por vencimento, direto do KPH.</Text>
          </View>
        </Reveal>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
          {units.map((unit) => {
            const active = unit.id === unitId;
            return <Pressable key={unit.id} accessibilityRole="button" accessibilityLabel={`Ver contas de ${unit.brand}`} onPress={() => void controller.selectUnit(unit.id)} style={({ pressed }) => ({ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 99, backgroundColor: active ? colors.text : colors.surface, borderWidth: 1, borderColor: active ? colors.text : colors.line, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: active ? colors.bg : colors.text, fontSize: 12, fontWeight: "700" }}>{unit.brand}</Text></Pressable>;
          })}
        </ScrollView>

        {query.isPending ? <Loading /> : query.error ? <ErrorState message={query.error.message} retry={() => void query.refetch()} /> : query.data ? (
          <>
            <Reveal delay={50}>
              <LinearGradient colors={["#111827", "#1E293B", "#183C36"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24, borderRadius: 30, gap: 10, overflow: "hidden" }}>
                <View style={{ position: "absolute", width: 190, height: 190, borderRadius: 95, right: -45, top: -100, backgroundColor: "rgba(68,255,190,0.13)" }} />
                <Text style={{ color: "rgba(255,255,255,0.57)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}>SALDO TOTAL EM ABERTO</Text>
                <Text style={{ color: "white", fontSize: 38, fontWeight: "800", letterSpacing: -1.4 }}>{money.format(query.data.openAmount)}</Text>
                <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12 }}>{query.data.openCount} títulos · {current?.name}</Text>
              </LinearGradient>
            </Reveal>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
              <Metric label="VENCIDO" value={query.data.overdueAmount} tone={colors.danger} />
              <Metric label="VENCE HOJE" value={query.data.dueTodayAmount} tone={colors.warning} />
              <Metric label="PRÓXIMOS 7 DIAS" value={query.data.next7DaysAmount} tone={colors.neon} />
            </View>
            <View style={{ paddingHorizontal: 18, borderRadius: 27, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
              <View style={{ paddingTop: 19, paddingBottom: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 19, fontWeight: "800" }}>Próximos títulos</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{query.data.overdueCount} vencidos</Text></View>
              {query.data.items.length ? query.data.items.map((item, index) => <PayableRow key={item.id} item={item} index={index} />) : <View style={{ paddingVertical: 20 }}><Empty text="Nenhuma conta em aberto para esta casa." /></View>}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>Consulta financeira · nenhuma movimentação é realizada pelo app · atualizado em {new Date(query.data.updatedAt).toLocaleString("pt-BR")}</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
