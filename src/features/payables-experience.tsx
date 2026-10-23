import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useGhost } from "../state/provider";
import { Empty, ErrorState, Loading } from "../ui/components";
import { useTheme } from "../ui/theme";
import type {
  CashFlowDay,
  DatePeriod,
  PayableFilter,
  PayableItem,
} from "../contracts/gateways";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const exactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

function localDate(date: string) {
  return new Date(`${date}T12:00:00`);
}
function compactDate(date: string) {
  return localDate(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
function dayLabel(date: string) {
  const value = localDate(date);
  const week = value
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
  return `${week.charAt(0).toUpperCase()}${week.slice(1)} ${value.toLocaleDateString("pt-BR", { day: "2-digit" })}`;
}
function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function brDate(value: string) {
  return localDate(value).toLocaleDateString("pt-BR");
}
function parseBrDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const candidate = `${match[3]}-${match[2]}-${match[1]}`;
  const date = localDate(candidate);
  return Number.isNaN(date.getTime()) || isoDate(date) !== candidate
    ? null
    : candidate;
}
function dateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}
function datePeriod(kind: "today" | "week" | "month" | "next30"): DatePeriod {
  const today = new Date();
  if (kind === "today") return { start: isoDate(today), end: isoDate(today) };
  if (kind === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: isoDate(start), end: isoDate(end) };
  }
  if (kind === "month") {
    return {
      start: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  const end = new Date(today);
  end.setDate(today.getDate() + 29);
  return { start: isoDate(today), end: isoDate(end) };
}

function Reveal({
  children,
  delay = 0,
}: React.PropsWithChildren<{ delay?: number }>) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 430,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function Metric({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number;
  tone: string;
  detail?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 145,
        padding: 17,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        gap: 7,
      }}
    >
      <View
        style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tone }}
      />
      <Text
        style={{
          color: colors.muted,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.7,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 21,
          fontWeight: "800",
          letterSpacing: -0.7,
        }}
      >
        {money.format(value)}
      </Text>
      {detail ? (
        <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function PayableRow({
  item,
  index,
  showUnit,
}: {
  item: PayableItem;
  index: number;
  showUnit: boolean;
}) {
  const { colors } = useTheme();
  const overdue = item.status === "overdue";
  const today = item.status === "due_today";
  const paid = item.status === "paid";
  const tone = overdue ? colors.danger : today ? colors.warning : colors.neon;
  const status = paid
    ? `Pago${item.paidDate ? ` em ${localDate(item.paidDate).toLocaleDateString("pt-BR")}` : ""}`
    : overdue
      ? `${item.daysOverdue}d em atraso`
      : today
        ? "Vence hoje"
        : "A vencer";
  return (
    <Reveal delay={80 + index * 45}>
      <View
        style={{
          flexDirection: "row",
          gap: 13,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <View
          style={{
            width: 43,
            height: 43,
            borderRadius: 15,
            backgroundColor: `${tone}18`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={
              paid
                ? "checkmark-circle-outline"
                : overdue
                  ? "alert-circle-outline"
                  : "receipt-outline"
            }
            size={21}
            color={tone}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              {item.supplier}
            </Text>
            <Text
              style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}
            >
              {money.format(item.amount)}
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {item.document}
            {showUnit ? ` · ${item.unitName}` : ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Text style={{ color: tone, fontSize: 11, fontWeight: "700" }}>
              {status}
            </Text>
            {!paid && item.dueDate && (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                · {localDate(item.dueDate).toLocaleDateString("pt-BR")}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Reveal>
  );
}

function FlowDay({
  day,
  maximum,
  index,
}: {
  day: CashFlowDay;
  maximum: number;
  index: number;
}) {
  const { colors } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 620,
      delay: index * 65,
      useNativeDriver: true,
    }).start();
  }, [index, progress]);
  const incomingWidth =
    `${Math.max(day.incoming ? 5 : 0, (day.incoming / maximum) * 100)}%` as `${number}%`;
  const outgoingWidth =
    `${Math.max(day.outgoing ? 5 : 0, (day.outgoing / maximum) * 100)}%` as `${number}%`;
  return (
    <View
      accessibilityLabel={`${dayLabel(day.date)}: entradas ${exactMoney.format(day.incoming)}, saídas ${exactMoney.format(day.outgoing)}, acumulado ${exactMoney.format(day.balance)}`}
      style={{
        gap: 10,
        paddingVertical: 15,
        borderBottomWidth: index < 6 ? 1 : 0,
        borderBottomColor: colors.line,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
            {dayLabel(day.date)}
          </Text>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 99,
              backgroundColor: day.projected
                ? `${colors.warning}18`
                : `${colors.neon}18`,
            }}
          >
            <Text
              style={{
                color: day.projected ? colors.warning : colors.neon,
                fontSize: 8,
                fontWeight: "900",
                letterSpacing: 0.5,
              }}
            >
              {day.projected ? "PROJEÇÃO" : "REALIZADO"}
            </Text>
          </View>
        </View>
        <Text
          style={{
            color: day.balance < 0 ? colors.danger : colors.text,
            fontSize: 14,
            fontWeight: "800",
          }}
        >
          {money.format(day.balance)}
        </Text>
      </View>
      <View style={{ gap: 7 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="arrow-down" size={12} color={colors.neon} />
          <View
            style={{
              flex: 1,
              height: 7,
              borderRadius: 99,
              backgroundColor: colors.soft,
              overflow: "hidden",
              alignItems: "flex-start",
            }}
          >
            <Animated.View
              style={{
                width: incomingWidth,
                height: 7,
                borderRadius: 99,
                backgroundColor: colors.neon,
                transform: [{ scaleX: progress }],
              }}
            />
          </View>
          <Text
            style={{
              width: 88,
              textAlign: "right",
              color: colors.muted,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {money.format(day.incoming)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="arrow-up" size={12} color={colors.danger} />
          <View
            style={{
              flex: 1,
              height: 7,
              borderRadius: 99,
              backgroundColor: colors.soft,
              overflow: "hidden",
              alignItems: "flex-start",
            }}
          >
            <Animated.View
              style={{
                width: outgoingWidth,
                height: 7,
                borderRadius: 99,
                backgroundColor: colors.danger,
                transform: [{ scaleX: progress }],
              }}
            />
          </View>
          <Text
            style={{
              width: 88,
              textAlign: "right",
              color: colors.muted,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {money.format(day.outgoing)}
          </Text>
        </View>
      </View>
      {day.projected ? (
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          Média deste dia nas últimas 5 semanas
          {day.actualIncoming > 0
            ? ` · ${money.format(day.actualIncoming)} realizado`
            : ""}
        </Text>
      ) : null}
    </View>
  );
}

export function PayablesExperience() {
  const { state, controller, gateways } = useGhost();
  const { colors } = useTheme();
  const [view, setView] = useState<"payables" | "cashFlow">("payables");
  const [weekOffset, setWeekOffset] = useState(0);
  const [financeScope, setFinanceScope] = useState<string>("all");
  const [payableFilter, setPayableFilter] = useState<PayableFilter>("open");
  const [period, setPeriod] = useState<DatePeriod>(() => datePeriod("today"));
  const [startDraft, setStartDraft] = useState(() =>
    brDate(datePeriod("today").start),
  );
  const [endDraft, setEndDraft] = useState(() =>
    brDate(datePeriod("today").end),
  );
  const [periodError, setPeriodError] = useState<string | null>(null);
  const session = state.session;
  const unitId = state.unitId;
  const units = useMemo(
    () =>
      (state.bootstrap?.units ?? []).filter((unit) =>
        unit.capabilities.includes("dashboard.read"),
      ),
    [state.bootstrap?.units],
  );
  const allUnits = financeScope === "all";
  const current = units.find((unit) => unit.id === financeScope);
  const scopeLabel = allUnits ? "Todas as casas" : current?.name;
  const payables = useQuery({
    queryKey: [
      "payables",
      session?.userId,
      financeScope,
      payableFilter,
      period.start,
      period.end,
      state.generation,
    ],
    queryFn: ({ signal }) =>
      gateways.payables.get(
        {
          session: session!,
          unitId: allUnits ? unitId! : financeScope,
          signal,
        },
        payableFilter,
        allUnits,
        period,
      ),
    enabled: !!session && !!unitId && view === "payables",
  });
  const flow = useQuery({
    queryKey: [
      "cash-flow-week",
      session?.userId,
      financeScope,
      weekOffset,
      state.generation,
    ],
    queryFn: ({ signal }) =>
      gateways.cashFlow.getWeek(
        {
          session: session!,
          unitId: allUnits ? unitId! : financeScope,
          signal,
        },
        weekOffset,
        allUnits,
      ),
    enabled: !!session && !!unitId && view === "cashFlow",
  });
  const maximum = Math.max(
    1,
    ...(flow.data?.days.flatMap((day) => [day.incoming, day.outgoing]) ?? [1]),
  );
  const choosePeriod = (kind: "today" | "week" | "month" | "next30") => {
    const next = datePeriod(kind);
    setPeriod(next);
    setStartDraft(brDate(next.start));
    setEndDraft(brDate(next.end));
    setPeriodError(null);
  };
  const applyCustomPeriod = () => {
    const start = parseBrDate(startDraft);
    const end = parseBrDate(endDraft);
    if (!start || !end) return setPeriodError("Use o formato DD/MM/AAAA.");
    if (start > end)
      return setPeriodError("A data inicial deve vir antes da final.");
    setPeriod({ start, end });
    setPeriodError(null);
  };
  const isToday =
    period.start === datePeriod("today").start &&
    period.end === datePeriod("today").end;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -110,
          right: -100,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: colors.auroraTwo,
          opacity: 0.26,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          padding: 22,
          paddingBottom: 55,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Reveal>
          <View style={{ gap: 7 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
            >
              <Ionicons name="wallet-outline" color={colors.neon} size={22} />
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 1.5,
                }}
              >
                FINANCEIRO
              </Text>
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 37,
                lineHeight: 41,
                fontWeight: "800",
                letterSpacing: -1.5,
              }}
            >
              Seu caixa, sem ruído.
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              Contas abertas e projeção semanal direto do KPH.
            </Text>
          </View>
        </Reveal>

        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            padding: 5,
            borderRadius: 18,
            backgroundColor: colors.soft,
            gap: 5,
          }}
        >
          {(
            [
              ["payables", "Contas a pagar", "receipt-outline"],
              ["cashFlow", "Fluxo da semana", "pulse-outline"],
            ] as const
          ).map(([key, label, icon]) => {
            const active = view === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setView(key)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 14,
                  backgroundColor: active ? colors.surface : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons
                  name={icon}
                  color={active ? colors.neon : colors.muted}
                  size={17}
                />
                <Text
                  style={{
                    color: active ? colors.text : colors.muted,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 9 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver financeiro de todas as casas"
            onPress={() => setFinanceScope("all")}
            style={({ pressed }) => ({
              paddingHorizontal: 15,
              paddingVertical: 10,
              borderRadius: 99,
              backgroundColor: allUnits ? colors.text : colors.surface,
              borderWidth: 1,
              borderColor: allUnits ? colors.text : colors.line,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: allUnits ? colors.bg : colors.text,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              Todas as casas
            </Text>
          </Pressable>
          {units.map((unit) => {
            const active = unit.id === financeScope;
            return (
              <Pressable
                key={unit.id}
                accessibilityRole="button"
                accessibilityLabel={`Ver financeiro de ${unit.brand}`}
                onPress={() => {
                  setFinanceScope(unit.id);
                  void controller.selectUnit(unit.id);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  borderRadius: 99,
                  backgroundColor: active ? colors.text : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.text : colors.line,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? colors.bg : colors.text,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {unit.brand}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {view === "payables" ? (
          <>
            <View
              style={{
                padding: 16,
                borderRadius: 23,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                gap: 13,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: "800",
                    }}
                  >
                    Período de vencimento
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}
                  >
                    {brDate(period.start)} a {brDate(period.end)}
                  </Text>
                </View>
                <Ionicons
                  name="calendar-outline"
                  size={21}
                  color={colors.neon}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7 }}
              >
                {(
                  [
                    ["today", "Hoje"],
                    ["week", "Esta semana"],
                    ["month", "Este mês"],
                    ["next30", "Próximos 30 dias"],
                  ] as const
                ).map(([key, label]) => {
                  const candidate = datePeriod(key);
                  const active =
                    period.start === candidate.start &&
                    period.end === candidate.end;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => choosePeriod(key)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: active
                          ? `${colors.neon}20`
                          : colors.soft,
                        borderWidth: 1,
                        borderColor: active
                          ? `${colors.neon}65`
                          : "transparent",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: active ? colors.neon : colors.muted,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 9,
                      fontWeight: "800",
                    }}
                  >
                    DE
                  </Text>
                  <TextInput
                    accessibilityLabel="Data inicial"
                    value={startDraft}
                    onChangeText={(value) => setStartDraft(dateInput(value))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={10}
                    style={{
                      height: 43,
                      paddingHorizontal: 11,
                      borderRadius: 12,
                      color: colors.text,
                      backgroundColor: colors.soft,
                      borderWidth: 1,
                      borderColor: colors.line,
                      fontSize: 12,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 9,
                      fontWeight: "800",
                    }}
                  >
                    ATÉ
                  </Text>
                  <TextInput
                    accessibilityLabel="Data final"
                    value={endDraft}
                    onChangeText={(value) => setEndDraft(dateInput(value))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={10}
                    style={{
                      height: 43,
                      paddingHorizontal: 11,
                      borderRadius: 12,
                      color: colors.text,
                      backgroundColor: colors.soft,
                      borderWidth: 1,
                      borderColor: colors.line,
                      fontSize: 12,
                    }}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aplicar período"
                  onPress={applyCustomPeriod}
                  style={({ pressed }) => ({
                    height: 43,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.accentText,
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    Aplicar
                  </Text>
                </Pressable>
              </View>
              {periodError ? (
                <Text style={{ color: colors.danger, fontSize: 11 }}>
                  {periodError}
                </Text>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {(
                [
                  ["open", "Em aberto"],
                  ["upcoming", "A vencer"],
                  ["overdue", "Vencidas"],
                  ["paid", "Pagas"],
                ] as const
              ).map(([key, label]) => {
                const active = payableFilter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setPayableFilter(key)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 13,
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.line,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: active ? colors.accentText : colors.text,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {payables.isPending ? (
              <Loading />
            ) : payables.error ? (
              <ErrorState
                message={payables.error.message}
                retry={() => void payables.refetch()}
              />
            ) : payables.data ? (
              <>
                <Reveal delay={50}>
                  <LinearGradient
                    colors={["#111827", "#1E293B", "#183C36"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      padding: 24,
                      borderRadius: 30,
                      gap: 10,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        width: 190,
                        height: 190,
                        borderRadius: 95,
                        right: -45,
                        top: -100,
                        backgroundColor: "rgba(68,255,190,0.13)",
                      }}
                    />
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.57)",
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 1.2,
                      }}
                    >
                      {payableFilter === "paid"
                        ? "TOTAL PAGO"
                        : payableFilter === "overdue"
                          ? "TOTAL VENCIDO"
                          : payableFilter === "upcoming"
                            ? "TOTAL A VENCER"
                            : "SALDO TOTAL EM ABERTO"}
                    </Text>
                    <Text
                      style={{
                        color: "white",
                        fontSize: 38,
                        fontWeight: "800",
                        letterSpacing: -1.4,
                      }}
                    >
                      {money.format(
                        payableFilter === "paid"
                          ? payables.data.paidAmount
                          : payableFilter === "overdue"
                            ? payables.data.overdueAmount
                            : payableFilter === "upcoming"
                              ? Math.max(
                                  0,
                                  payables.data.openAmount -
                                    payables.data.overdueAmount,
                                )
                              : payables.data.openAmount,
                      )}
                    </Text>
                    <Text
                      style={{ color: "rgba(255,255,255,0.62)", fontSize: 12 }}
                    >
                      {payableFilter === "paid"
                        ? payables.data.paidCount
                        : payables.data.openCount}{" "}
                      títulos · {scopeLabel}
                    </Text>
                  </LinearGradient>
                </Reveal>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}
                >
                  <Metric
                    label="VENCIDO"
                    value={payables.data.overdueAmount}
                    tone={colors.danger}
                  />
                  <Metric
                    label="VENCE HOJE"
                    value={payables.data.dueTodayAmount}
                    tone={colors.warning}
                  />
                  <Metric
                    label="PRÓXIMOS 7 DIAS"
                    value={payables.data.next7DaysAmount}
                    tone={colors.neon}
                  />
                </View>
                <View
                  style={{
                    paddingHorizontal: 18,
                    borderRadius: 27,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <View
                    style={{
                      paddingTop: 19,
                      paddingBottom: 4,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 19,
                          fontWeight: "800",
                        }}
                      >
                        {isToday && payableFilter === "open"
                          ? "Contas de hoje"
                          : payableFilter === "paid"
                            ? "Contas pagas"
                            : payableFilter === "overdue"
                              ? "Contas vencidas"
                              : payableFilter === "upcoming"
                                ? "Contas a vencer"
                                : "Todas em aberto"}
                      </Text>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        {brDate(period.start)} a {brDate(period.end)}
                      </Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {payables.data.items.length} contas
                    </Text>
                  </View>
                  {payables.data.items.length ? (
                    payables.data.items.map((item, index) => (
                      <PayableRow
                        key={item.id}
                        item={item}
                        index={index}
                        showUnit={allUnits}
                      />
                    ))
                  ) : (
                    <View style={{ paddingVertical: 20 }}>
                      <Empty text="Nenhuma conta nesta situação." />
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 11,
                    textAlign: "center",
                  }}
                >
                  Consulta financeira · nenhuma movimentação é realizada pelo
                  app · atualizado em{" "}
                  {new Date(payables.data.updatedAt).toLocaleString("pt-BR")}
                </Text>
              </>
            ) : null}
          </>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 9 }}
            >
              {[0, 1, 2, 3].map((offset) => {
                const active = weekOffset === offset;
                return (
                  <Pressable
                    key={offset}
                    accessibilityRole="button"
                    accessibilityLabel={
                      offset === 0
                        ? "Ver semana atual"
                        : `Ver semana mais ${offset}`
                    }
                    onPress={() => setWeekOffset(offset)}
                    style={({ pressed }) => ({
                      minWidth: 116,
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      borderRadius: 17,
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.line,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: active ? colors.accentText : colors.text,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {offset === 0 ? "Semana atual" : `Semana +${offset}`}
                    </Text>
                    {active && flow.data ? (
                      <Text
                        style={{
                          color: active ? colors.accentText : colors.muted,
                          opacity: 0.72,
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        {compactDate(flow.data.weekStart)}–
                        {compactDate(flow.data.weekEnd)}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {flow.isPending ? (
              <Loading />
            ) : flow.error ? (
              <ErrorState
                message={flow.error.message}
                retry={() => void flow.refetch()}
              />
            ) : flow.data ? (
              <>
                <Reveal delay={40}>
                  <LinearGradient
                    colors={
                      flow.data.balance < 0
                        ? ["#24151D", "#3B1E2C", "#20243B"]
                        : ["#0D2F28", "#155E4B", "#1E3A5F"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      padding: 24,
                      borderRadius: 30,
                      gap: 10,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        width: 220,
                        height: 220,
                        borderRadius: 110,
                        right: -60,
                        top: -110,
                        backgroundColor: "rgba(103,232,249,0.12)",
                      }}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.6)",
                          fontSize: 11,
                          fontWeight: "800",
                          letterSpacing: 1.2,
                        }}
                      >
                        ACUMULADO DA SEMANA
                      </Text>
                      <Ionicons
                        name="sparkles-outline"
                        color="rgba(255,255,255,0.75)"
                        size={18}
                      />
                    </View>
                    <Text
                      style={{
                        color: "white",
                        fontSize: 38,
                        fontWeight: "800",
                        letterSpacing: -1.4,
                      }}
                    >
                      {money.format(flow.data.balance)}
                    </Text>
                    <Text
                      style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}
                    >
                      {compactDate(flow.data.weekStart)} a{" "}
                      {compactDate(flow.data.weekEnd)} · {scopeLabel}
                    </Text>
                  </LinearGradient>
                </Reveal>
                <View style={{ flexDirection: "row", gap: 11 }}>
                  <Metric
                    label="ENTRADAS DA SEMANA"
                    value={flow.data.incoming}
                    tone={colors.neon}
                    detail={`${money.format(flow.data.actualIncoming)} realizado · ${money.format(flow.data.projectedIncoming)} projetado`}
                  />
                  <Metric
                    label="SAÍDAS"
                    value={flow.data.outgoing}
                    tone={colors.danger}
                  />
                </View>
                {flow.data.goesNegative ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                      padding: 14,
                      borderRadius: 18,
                      backgroundColor: `${colors.danger}12`,
                      borderWidth: 1,
                      borderColor: `${colors.danger}35`,
                    }}
                  >
                    <Ionicons
                      name="warning-outline"
                      color={colors.danger}
                      size={19}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.danger,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      O acumulado fica negativo em algum dia desta semana.
                    </Text>
                  </View>
                ) : null}
                <View
                  style={{
                    paddingHorizontal: 18,
                    borderRadius: 27,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <View style={{ paddingTop: 19, paddingBottom: 4, gap: 4 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 19,
                        fontWeight: "800",
                      }}
                    >
                      Ritmo diário
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      Entrada em verde · saída em vermelho · valor à direita é o
                      acumulado
                    </Text>
                  </View>
                  {flow.data.days.map((day, index) => (
                    <FlowDay
                      key={day.date}
                      day={day}
                      maximum={maximum}
                      index={index}
                    />
                  ))}
                </View>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 11,
                    textAlign: "center",
                  }}
                >
                  Semana de segunda a domingo · realizado até ontem · hoje e
                  dias futuros usam a média do mesmo dia nas últimas{" "}
                  {flow.data.historyWeeks} semanas · atualizado em{" "}
                  {new Date(flow.data.updatedAt).toLocaleString("pt-BR")}
                </Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
