import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQueries } from "@tanstack/react-query";
import type { Dashboard, DashboardPoint, Unit } from "../contracts/gateways";
import { useGhost } from "../state/provider";
import { environment } from "../config/environment";
import { ErrorState, Loading } from "../ui/components";
import { useTheme } from "../ui/theme";
import { currentMonth, MonthSelector, monthLabel } from "../ui/month-selector";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

type BrandStyle = {
  label: string;
  colors: readonly [string, string, ...string[]];
  glow: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const stylesByBrand: Record<string, BrandStyle> = {
  meet: {
    label: "Meet",
    colors: ["#0B694E", "#13A275", "#62E6B7"],
    glow: "#49E5B0",
    icon: "restaurant-outline",
  },
  mdna: {
    label: "Mdna",
    colors: ["#5A2FA0", "#8B5CF6", "#D9C5FF"],
    glow: "#B99AFF",
    icon: "sparkles-outline",
  },
  freneze: {
    label: "Freneze",
    colors: ["#A33D42", "#EC6B5F", "#FFB58D"],
    glow: "#FF957C",
    icon: "flame-outline",
  },
  match: {
    label: "Match",
    colors: ["#1558A0", "#3184DC", "#72D9FF"],
    glow: "#55C8FF",
    icon: "flash-outline",
  },
  other: {
    label: "Casa",
    colors: ["#273A4A", "#41647A", "#75AABD"],
    glow: "#75D2D0",
    icon: "business-outline",
  },
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function brandStyle(unit: Unit): BrandStyle {
  const value = normalize(`${unit.name} ${unit.brand}`);
  if (value.includes("meet")) return stylesByBrand.meet!;
  if (value.includes("mdna") || value.includes("madonna"))
    return stylesByBrand.mdna!;
  if (value.includes("freneze")) return stylesByBrand.freneze!;
  if (value.includes("match")) return stylesByBrand.match!;
  return { ...stylesByBrand.other!, label: unit.brand || unit.name };
}

export function orderPortfolioUnits(units: Unit[]) {
  const order = ["meet", "mdna", "freneze", "match"];
  return units
    .filter((unit) => unit.capabilities.includes("dashboard.read"))
    .sort((a, b) => {
      const aLabel = normalize(brandStyle(a).label);
      const bLabel = normalize(brandStyle(b).label);
      const ai = order.indexOf(aLabel);
      const bi = order.indexOf(bLabel);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
}

function AnimatedAmount({ value, color, size = 30 }: { value: number | null; color: string; size?: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    const listener = progress.addListener(({ value: current }) =>
      setDisplay(Math.round((value ?? 0) * current)),
    );
    Animated.timing(progress, {
      toValue: 1,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(listener);
  }, [progress, value]);
  return (
    <Text
      adjustsFontSizeToFit
      numberOfLines={1}
      style={{ color, fontSize: size, fontWeight: "800", letterSpacing: -1.4, fontVariant: ["tabular-nums"] }}
    >
      {value === null ? "Sem dados" : currency.format(display)}
    </Text>
  );
}

function Reveal({ children, delay = 0 }: React.PropsWithChildren<{ delay?: number }>) {
  const [animation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animation, delay]);
  return (
    <Animated.View
      style={{
        opacity: animation,
        transform: [
          { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function LiveDot({ color }: { color: string }) {
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: pulse, transform: [{ scale: pulse }] }}
    />
  );
}

function PortfolioCard({ unit, data, onPress, delay }: { unit: Unit; data?: Dashboard; onPress: () => void; delay: number }) {
  const brand = brandStyle(unit);
  return (
    <Reveal delay={delay}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir dashboard ${brand.label}`}
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.975 : 1 }] })}
      >
        <LinearGradient
          colors={brand.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ minHeight: 190, borderRadius: 28, padding: 20, overflow: "hidden", justifyContent: "space-between", shadowColor: brand.glow, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 8 }}
        >
          <View style={{ position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.13)", right: -55, top: -50 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.17)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={brand.icon} size={20} color="#FFFFFF" />
            </View>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.9)" />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: "rgba(255,255,255,0.74)", fontSize: 11, fontWeight: "700", letterSpacing: 1.25 }}>
              FATURAMENTO TOTAL {brand.label.toUpperCase()}
            </Text>
            <AnimatedAmount value={data?.revenue ?? null} color="#FFFFFF" size={28} />
            <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 12 }}>
              {data?.goalProgress == null ? "Mês atual" : `${Math.round(data.goalProgress * 100)}% da meta até agora`}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Reveal>
  );
}

function AnimatedProgress({ value, color }: { value: number; color: string }) {
  const [width] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(width, { toValue: Math.min(Math.max(value, 0), 1), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, width]);
  return (
    <View style={{ height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.11)", overflow: "hidden" }}>
      <Animated.View style={{ height: 8, borderRadius: 8, backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

function RevenueChart({ points, color }: { points: DashboardPoint[]; color: string }) {
  const visible = points.filter((point) => point.revenue !== null || point.goal !== null).slice(-14);
  const maximum = Math.max(1, ...visible.flatMap((point) => [point.revenue ?? 0, point.goal ?? 0]));
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700", letterSpacing: -0.5 }}>Ritmo diário</Text>
          <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 13 }}>Últimos {visible.length} dias com movimento</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><LiveDot color={color} /><Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, letterSpacing: 1 }}>AO VIVO</Text></View>
      </View>
      {visible.length === 0 ? (
        <Text style={{ color: "rgba(255,255,255,0.58)" }}>A série diária aparecerá assim que houver movimento.</Text>
      ) : (
        <View style={{ height: 196, flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
          {visible.map((point, index) => (
            <ChartBar key={point.date} point={point} maximum={maximum} color={color} delay={index * 45} showLabel={index === 0 || index === visible.length - 1 || index % 4 === 0} />
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} /><Text style={{ color: "rgba(255,255,255,0.58)", fontSize: 12 }}>Faturamento</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 14, height: 2, backgroundColor: "rgba(255,255,255,0.48)" }} /><Text style={{ color: "rgba(255,255,255,0.58)", fontSize: 12 }}>Meta diária</Text></View>
      </View>
    </View>
  );
}

function ChartBar({ point, maximum, color, delay, showLabel }: { point: DashboardPoint; maximum: number; color: string; delay: number; showLabel: boolean }) {
  const [scale] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, delay, speed: 10, bounciness: 5, useNativeDriver: true }).start();
  }, [delay, scale]);
  const barHeight = Math.max(5, ((point.revenue ?? 0) / maximum) * 150);
  const goalBottom = ((point.goal ?? 0) / maximum) * 150 + 22;
  return (
    <View style={{ flex: 1, minWidth: 7, height: 190, justifyContent: "flex-end", alignItems: "center" }}>
      {point.goal !== null && <View style={{ position: "absolute", bottom: goalBottom, height: 1, width: "95%", backgroundColor: "rgba(255,255,255,0.42)" }} />}
      <Animated.View style={{ width: "72%", minWidth: 6, height: barHeight, borderRadius: 6, backgroundColor: point.provisional ? `${color}99` : color, transform: [{ scaleY: scale }], transformOrigin: "bottom" }} />
      <Text style={{ height: 18, marginTop: 4, color: "rgba(255,255,255,0.42)", fontSize: 9 }}>{showLabel ? new Date(`${point.date}T12:00:00`).getDate() : ""}</Text>
    </View>
  );
}

function HousePicker({ visible, units, onClose, onSelect }: { visible: boolean; units: Unit[]; onClose: () => void; onSelect: (unit: Unit) => void }) {
  const { colors } = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,8,14,0.72)" }}>
        <Pressable onPress={(event) => event.stopPropagation()}>
          <View style={{ backgroundColor: colors.elevated, borderTopLeftRadius: 34, borderTopRightRadius: 34, padding: 24, paddingBottom: 42, gap: 14, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 8 }} />
            <Text style={{ color: colors.text, fontSize: 25, fontWeight: "800", letterSpacing: -0.8 }}>Escolha uma casa</Text>
            <Text style={{ color: colors.muted, marginBottom: 4 }}>Abra a visão completa de faturamento e ritmo diário.</Text>
            {units.map((unit) => {
              const brand = brandStyle(unit);
              return (
                <Pressable key={unit.id} accessibilityRole="button" accessibilityLabel={`Selecionar ${brand.label}`} onPress={() => onSelect(unit)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.7 : 1 })}>
                  <LinearGradient colors={brand.colors} style={{ width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" }}><Ionicons name={brand.icon} size={22} color="#fff" /></LinearGradient>
                  <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>{brand.label}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{unit.name}</Text></View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DashboardExperience() {
  const { state, controller, gateways } = useGhost();
  const { colors } = useTheme();
  const [view, setView] = useState<"portfolio" | "detail">("portfolio");
  const [picker, setPicker] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const units = useMemo(() => orderPortfolioUnits(state.bootstrap?.units ?? []), [state.bootstrap?.units]);
  const session = state.session;
  const queries = useQueries({
    queries: units.map((unit) => ({
      queryKey: ["dashboard", session?.userId, unit.id, month, state.generation],
      queryFn: ({ signal }: { signal: AbortSignal }) => gateways.dashboard.get({ session: session!, unitId: unit.id, signal }, month),
      enabled: !!session,
    })),
  });
  const currentIndex = units.findIndex((unit) => unit.id === state.unitId);
  const currentUnit = currentIndex >= 0 ? units[currentIndex] : units[0];
  const currentQuery = currentIndex >= 0 ? queries[currentIndex] : queries[0];
  const total = queries.reduce((sum, query) => sum + (query.data?.revenue ?? 0), 0);
  const pending = queries.some((query) => query.isPending);

  async function select(unit: Unit) {
    setPicker(false);
    await controller.selectUnit(unit.id);
    setView("detail");
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (!session) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View pointerEvents="none" style={{ position: "absolute", top: -100, right: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: colors.auroraOne, opacity: 0.32 }} />
      <View pointerEvents="none" style={{ position: "absolute", top: 310, left: -150, width: 290, height: 290, borderRadius: 145, backgroundColor: colors.auroraTwo, opacity: 0.18 }} />
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", padding: 22, paddingBottom: 54, gap: 22 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -1.2 }}>ghost</Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.neon }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.line }}>
            <LiveDot color={colors.neon} />
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>{environment.isRemote ? "KPH LIVE" : "DEMO"}</Text>
          </View>
        </View>

        {view === "portfolio" ? (
          <>
            <Reveal>
              <View style={{ gap: 7, marginTop: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>Boa visão, {session.displayName.split(" ")[0]}.</Text>
                <Text style={{ color: colors.text, fontSize: 37, lineHeight: 41, fontWeight: "800", letterSpacing: -1.7 }}>Seu grupo em{`\n`}movimento.</Text>
              </View>
            </Reveal>
            <Reveal delay={70}>
              <View style={{ padding: 22, borderRadius: 26, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.line, gap: 7 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.3 }}>FATURAMENTO DO PORTFÓLIO · MÊS ATUAL</Text>
                {pending ? <Text style={{ color: colors.text, fontSize: 32, fontWeight: "800" }}>Calculando…</Text> : <AnimatedAmount value={total} color={colors.text} size={34} />}
                <Text style={{ color: colors.muted, fontSize: 13 }}>{units.length} casas autorizadas · dados consolidados pelo KPH</Text>
              </View>
            </Reveal>
            {state.mode === "offline" && <Text style={{ color: colors.warning }}>Offline simulado · os dados podem estar desatualizados.</Text>}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {units.map((unit, index) => (
                <View key={unit.id} style={{ flexGrow: 1, flexBasis: Platform.OS === "web" ? 300 : "46%", minWidth: 150 }}>
                  <PortfolioCard unit={unit} data={queries[index]?.data} onPress={() => void select(unit)} delay={120 + index * 90} />
                </View>
              ))}
            </View>
            {queries.some((query) => query.error) && <ErrorState message="Algumas casas não puderam ser atualizadas." retry={() => queries.forEach((query) => void query.refetch())} />}
            <Reveal delay={420}>
              <Pressable accessibilityRole="button" onPress={() => setPicker(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}><Ionicons name="options-outline" size={20} color={colors.neon} /></View><View><Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Escolher casa</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Abrir dashboard completo</Text></View></View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            </Reveal>
            <Reveal delay={480}>
              <View style={{ gap: 13 }}>
                <View><Text style={{ color: colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.6 }}>Ontem nas casas</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>Faturamento de {yesterday.toLocaleDateString("pt-BR")}</Text></View>
                <View style={{ gap: 9 }}>
                  {units.map((unit, index) => {
                    const brand = brandStyle(unit);
                    const point = queries[index]?.data?.series.find((item) => item.date === yesterdayKey);
                    return <View key={unit.id} style={{ flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 12 }}><LinearGradient colors={brand.colors} style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }}><Ionicons name={brand.icon} color="#fff" size={19} /></LinearGradient><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "700" }}>{brand.label}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{point?.provisional ? "Conciliação em andamento" : "Fechamento do dia"}</Text></View><Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{point?.revenue == null ? "—" : compactCurrency.format(point.revenue)}</Text></View>;
                  })}
                </View>
              </View>
            </Reveal>
          </>
        ) : !currentUnit || currentQuery?.isPending ? (
          <Loading />
        ) : currentQuery?.error ? (
          <ErrorState message={currentQuery.error.message} retry={() => void currentQuery.refetch()} />
        ) : currentQuery?.data ? (
          <UnitDetail unit={currentUnit} dashboard={currentQuery.data} month={month} onMonth={setMonth} onBack={() => { setMonth(currentMonth()); setView("portfolio"); }} onPick={() => setPicker(true)} />
        ) : null}
      </ScrollView>
      <HousePicker visible={picker} units={units} onClose={() => setPicker(false)} onSelect={(unit) => void select(unit)} />
    </SafeAreaView>
  );
}

function UnitDetail({ unit, dashboard, month, onMonth, onBack, onPick }: { unit: Unit; dashboard: Dashboard; month: string; onMonth: (month: string) => void; onBack: () => void; onPick: () => void }) {
  const { colors } = useTheme();
  const brand = brandStyle(unit);
  const goalProgress = dashboard.goalProgress ?? 0;
  const bestDay = dashboard.series.reduce<DashboardPoint | null>((best, point) => !best || (point.revenue ?? 0) > (best.revenue ?? 0) ? point : best, null);
  return (
    <>
      <Reveal>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao portfólio" onPress={onBack} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
          <Pressable accessibilityRole="button" onPress={onPick} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, height: 44, borderRadius: 16, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.line }}><Text style={{ color: colors.text, fontWeight: "700" }}>{brand.label}</Text><Ionicons name="chevron-down" size={16} color={colors.muted} /></Pressable>
        </View>
      </Reveal>
      <Reveal delay={35}><MonthSelector value={month} onChange={onMonth} /></Reveal>
      <Reveal delay={60}>
        <LinearGradient colors={brand.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 32, padding: 25, gap: 23, overflow: "hidden", shadowColor: brand.glow, shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 9 }}>
          <View style={{ position: "absolute", width: 230, height: 230, borderRadius: 115, right: -65, top: -100, backgroundColor: "rgba(255,255,255,0.14)" }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><View><Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700", letterSpacing: 1.3, textTransform: "uppercase" }}>FATURAMENTO · {monthLabel(month, true)}</Text><Text style={{ color: "rgba(255,255,255,0.72)", marginTop: 5, fontSize: 13 }}>{unit.name}</Text></View><View style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.17)", alignItems: "center", justifyContent: "center" }}><Ionicons name={brand.icon} color="#fff" size={22} /></View></View>
          <AnimatedAmount value={dashboard.revenue} color="#FFFFFF" size={42} />
          <View style={{ gap: 10 }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Meta acumulada</Text><Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>{Math.round(goalProgress * 100)}%</Text></View><AnimatedProgress value={goalProgress} color="#FFFFFF" /></View>
          {dashboard.provisional && <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Ionicons name="time-outline" color="rgba(255,255,255,0.82)" size={15} /><Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 11 }}>Há conciliações de pagamento em processamento</Text></View>}
        </LinearGradient>
      </Reveal>
      <Reveal delay={150}>
        <View style={{ backgroundColor: "#101821", borderRadius: 30, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <RevenueChart points={dashboard.series} color={brand.glow} />
        </View>
      </Reveal>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><Reveal delay={240}><Metric icon="flag-outline" label="Meta acumulada" value={dashboard.goal == null ? "—" : compactCurrency.format(dashboard.goal)} color={brand.glow} /></Reveal></View>
        <View style={{ flex: 1 }}><Reveal delay={310}><Metric icon="trophy-outline" label="Melhor dia" value={bestDay?.revenue == null ? "—" : compactCurrency.format(bestDay.revenue)} color={brand.glow} /></Reveal></View>
      </View>
      <RevenueOverview dashboard={dashboard} color={brand.glow} />
      <DailyRevenueList points={dashboard.series} color={brand.glow} />
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>Atualizado em {new Date(dashboard.updatedAt).toLocaleString("pt-BR")}</Text>
    </>
  );
}

function DailyRevenueList({ points, color }: { points: DashboardPoint[]; color: string }) {
  const { colors } = useTheme();
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());
  const days = points.filter((point) => point.revenue !== null).sort((a, b) => b.date.localeCompare(a.date));
  const allExpanded = days.length > 0 && days.every((day) => expandedDates.has(day.date));
  const toggle = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDates(allExpanded ? new Set() : new Set(days.filter((day) => day.shifts.length > 0).map((day) => day.date)));
  };
  return <Reveal delay={420}>
    <View style={{ borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
      <View style={{ padding: 19, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}><View><Text style={{ color: colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.6 }}>Faturamento dia a dia</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>Toque em um dia para ver os turnos</Text></View>{days.some((day) => day.shifts.length > 0) && <Pressable accessibilityRole="button" onPress={toggleAll} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 13, backgroundColor: colors.soft, opacity: pressed ? 0.7 : 1 })}><Text style={{ color, fontSize: 10, fontWeight: "800" }}>{allExpanded ? "RECOLHER" : "EXPANDIR"}</Text></Pressable>}</View>
      {days.length === 0 ? <Text style={{ color: colors.muted, padding: 20 }}>Nenhum fechamento neste mês.</Text> : days.map((day) => {
        const expanded = expandedDates.has(day.date);
        const goalProgress = day.goal && day.goal > 0 && day.revenue != null ? day.revenue / day.goal : null;
        const statusColor = goalProgress == null ? colors.muted : goalProgress >= 1 ? colors.neon : goalProgress >= 0.7 ? colors.warning : "#FF6B72";
        const date = new Date(`${day.date}T12:00:00`);
        return <View key={day.date} style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Faturamento de ${date.toLocaleDateString("pt-BR")}`} accessibilityState={{ expanded }} onPress={() => day.shifts.length > 0 && toggle(day.date)} style={({ pressed }) => ({ padding: 16, gap: 12, opacity: pressed ? 0.72 : 1, borderLeftWidth: 3, borderLeftColor: statusColor })}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 32, alignItems: "center" }}>{day.shifts.length > 0 && <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={color} />}</View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>{date.toLocaleDateString("pt-BR")} <Text style={{ color: colors.muted, fontWeight: "500" }}>{date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</Text></Text><Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>{day.shifts.length} {day.shifts.length === 1 ? "turno" : "turnos"}{day.provisional ? " · provisório" : ""}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>{currency.format(day.revenue ?? 0)}</Text><Text style={{ color: statusColor, fontSize: 10, fontWeight: "800" }}>{goalProgress == null ? "SEM META" : `${Math.round(goalProgress * 100)}% DA META`}</Text></View></View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><DayMetric label="Meta" value={day.goal == null ? "—" : compactCurrency.format(day.goal)} /><DayMetric label="Desconto" value={day.discount == null ? "—" : compactCurrency.format(day.discount)} /><DayMetric label="Gorjeta" value={day.tips == null ? "—" : compactCurrency.format(day.tips)} /><DayMetric label="Clientes" value={day.customers?.toLocaleString("pt-BR") ?? "—"} /><DayMetric label="Ticket" value={day.averageTicket == null ? "—" : currency.format(day.averageTicket)} /></View>
          </Pressable>
          {expanded && <View style={{ paddingHorizontal: 16, paddingBottom: 15, gap: 8, backgroundColor: colors.soft }}>
            {day.shifts.map((shift) => <View key={shift.id} style={{ padding: 13, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 9 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: shift.name === "almoco" ? "#F5A623" : shift.name === "jantar" ? "#8B7CFF" : color }} /><Text style={{ color: colors.text, fontWeight: "800" }}>{shift.name === "almoco" ? "Almoço" : shift.name === "jantar" ? "Jantar" : "Dia inteiro"}</Text>{shift.derived && <Text style={{ color: colors.muted, fontSize: 8, fontWeight: "800", borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>DERIVADO</Text>}</View><Text style={{ color: colors.text, fontWeight: "900" }}>{currency.format(shift.revenue)}</Text></View><View style={{ flexDirection: "row", gap: 12 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Gorjeta: {shift.tips == null ? "—" : currency.format(shift.tips)}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Clientes: {shift.customers ?? "—"}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Ticket: {shift.averageTicket == null ? "—" : currency.format(shift.averageTicket)}</Text></View></View>)}
          </View>}
        </View>;
      })}
    </View>
  </Reveal>;
}

function DayMetric({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return <View style={{ minWidth: 78, flexGrow: 1, padding: 9, borderRadius: 12, backgroundColor: colors.glass }}><Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>{value}</Text><Text style={{ color: colors.muted, fontSize: 8, marginTop: 2 }}>{label}</Text></View>;
}

function RevenueOverview({ dashboard, color }: { dashboard: Dashboard; color: string }) {
  const { colors } = useTheme();
  const metrics = [
    ["Projeção", dashboard.projection, "trending-up-outline"],
    ["Receita bruta", dashboard.grossRevenue, "cash-outline"],
    ["Recebido", dashboard.receivedRevenue, "checkmark-circle-outline"],
    ["Receita líquida", dashboard.netRevenue, "wallet-outline"],
    ["Descontos", dashboard.discount, "pricetag-outline"],
    ["Gorjeta", dashboard.tips, "sparkles-outline"],
  ] as const;
  return (
    <Reveal delay={360}>
      <View style={{ padding: 20, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 17 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text style={{ color: colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.6 }}>Receita do mês</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>Mesma leitura financeira do KPH</Text></View><View style={{ width: 39, height: 39, borderRadius: 14, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}><Ionicons name="analytics-outline" size={20} color={color} /></View></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {metrics.map(([label, value, icon]) => <View key={label} style={{ width: "48%", minHeight: 94, borderRadius: 19, backgroundColor: colors.soft, padding: 13, justifyContent: "space-between" }}><Ionicons name={icon} color={color} size={17} /><View><Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{value == null ? "—" : compactCurrency.format(value)}</Text><Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>{label}</Text></View></View>)}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: colors.glass }}><Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>{dashboard.customers?.toLocaleString("pt-BR") ?? "—"}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Clientes</Text></View><View style={{ flex: 1, borderRadius: 18, padding: 14, backgroundColor: colors.glass }}><Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>{dashboard.averageTicket == null ? "—" : currency.format(dashboard.averageTicket)}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Ticket médio</Text></View></View>
      </View>
    </Reveal>
  );
}

function Metric({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: 132, padding: 17, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: "space-between" }}>
      <Ionicons name={icon} size={20} color={color} />
      <View><Text style={{ color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.6 }}>{value}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{label}</Text></View>
    </View>
  );
}
