import React, { useEffect, useState } from "react";
import {
  LayoutAnimation,
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
import { ErrorState, Loading } from "../ui/components";
import { useTheme } from "../ui/theme";
import { currentMonth, MonthSelector, monthLabel } from "../ui/month-selector";
import { brandStyle } from "./dashboard-experience";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const exactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function ProductInvoicesExperience() {
  const { state, controller, gateways } = useGhost();
  const { colors } = useTheme();
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const session = state.session;
  const units = (state.bootstrap?.units ?? []).filter((unit) =>
    unit.capabilities.includes("operation.read"),
  );
  const unit = units.find((item) => item.id === state.unitId) ?? units[0];
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: [
      "product-invoices",
      session?.userId,
      unit?.id,
      month,
      searchTerm,
      state.generation,
    ],
    queryFn: ({ signal }) =>
      gateways.productInvoices.get(
        { session: session!, unitId: unit!.id, signal },
        month,
        searchTerm,
      ),
    enabled: !!session && !!unit,
  });
  const items = query.data?.items ?? [];

  if (!controller.can("operation.read"))
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}
      >
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>
          Acesso restrito
        </Text>
        <Text style={{ color: colors.muted, marginTop: 10 }}>
          As notas de produto não estão disponíveis para seu vínculo nesta casa.
        </Text>
      </SafeAreaView>
    );
  if (!unit || !session) return null;
  const brand = brandStyle(unit);
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
          right: -90,
          width: 270,
          height: 270,
          borderRadius: 140,
          backgroundColor: colors.auroraOne,
          opacity: 0.3,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          padding: 22,
          paddingBottom: 56,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 1.3,
            }}
          >
            COMPRAS · PRODUTOS
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: 36,
              fontWeight: "800",
              letterSpacing: -1.5,
              marginTop: 6,
            }}
          >
            Notas fiscais
          </Text>
          <Text style={{ color: colors.muted, marginTop: 5 }}>
            Documentos recebidos no mês selecionado.
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {units.map((candidate) => {
            const candidateBrand = brandStyle(candidate);
            const active = candidate.id === unit.id;
            return (
              <Pressable
                key={candidate.id}
                accessibilityRole="button"
                accessibilityLabel={`Ver notas de ${candidateBrand.label}`}
                onPress={() => void controller.selectUnit(candidate.id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  paddingHorizontal: 13,
                  paddingVertical: 10,
                  borderRadius: 16,
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.line,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Ionicons
                  name={candidateBrand.icon}
                  size={15}
                  color={active ? "#fff" : colors.muted}
                />
                <Text
                  style={{
                    color: active ? "#fff" : colors.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {candidateBrand.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <MonthSelector value={month} onChange={setMonth} />
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        ) : query.data ? (
          <>
            <LinearGradient
              colors={brand.colors}
              style={{
                borderRadius: 29,
                padding: 22,
                gap: 18,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  right: -45,
                  top: -80,
                  backgroundColor: "rgba(255,255,255,0.14)",
                }}
              />
              <View>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  TOTAL COMPRADO · {monthLabel(month, true)}
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 38,
                    fontWeight: "800",
                    letterSpacing: -1.5,
                    marginTop: 8,
                  }}
                >
                  {money.format(query.data.totalPurchased)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Stat label="Notas" value={String(query.data.invoiceCount)} />
                <Stat
                  label="Fornecedores"
                  value={String(query.data.supplierCount)}
                />
              </View>
            </LinearGradient>
            <View style={{ gap: 7 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 15,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: search ? `${brand.glow}80` : colors.line,
                }}
              >
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={search ? brand.glow : colors.muted}
                />
                <TextInput
                  accessibilityLabel="Buscar produto, fornecedor ou número da nota"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Produto, fornecedor ou número da NF"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={{ flex: 1, color: colors.text, fontSize: 14 }}
                />
                {search ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Limpar busca"
                    onPress={() => setSearch("")}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>
                ) : null}
              </View>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  paddingHorizontal: 3,
                }}
              >
                {query.isFetching && !query.isPending
                  ? "Buscando no KPH…"
                  : searchTerm
                    ? `Resultados para “${searchTerm}”`
                    : "Busque também pelo nome de qualquer item da nota."}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: "800",
                  }}
                >
                  NFs de produto
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {items.length} exibidas
                </Text>
              </View>
              {items.length === 0 ? (
                <View
                  style={{
                    padding: 24,
                    borderRadius: 22,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Nenhuma nota encontrada
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 5 }}>
                    Ajuste a busca ou selecione outro mês.
                  </Text>
                </View>
              ) : (
                items.map((item) => {
                  const expanded = expandedInvoice === item.id;
                  return (
                    <View
                      key={item.id}
                      style={{
                        borderRadius: 22,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: expanded ? `${brand.glow}80` : colors.line,
                        overflow: "hidden",
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${expanded ? "Fechar" : "Abrir"} itens da nota ${item.invoiceNumber}`}
                        accessibilityState={{ expanded }}
                        onPress={() => {
                          LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut,
                          );
                          setExpandedInvoice(expanded ? null : item.id);
                        }}
                        style={({ pressed }) => ({
                          padding: 16,
                          gap: 10,
                          opacity: pressed ? 0.72 : 1,
                        })}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 14,
                              backgroundColor: `${brand.glow}20`,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons
                              name="receipt-outline"
                              size={19}
                              color={brand.glow}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              numberOfLines={2}
                              style={{
                                color: colors.text,
                                fontWeight: "700",
                                fontSize: 14,
                              }}
                            >
                              {item.supplier}
                            </Text>
                            <Text
                              style={{
                                color: colors.muted,
                                fontSize: 11,
                                marginTop: 3,
                              }}
                            >
                              NF {item.invoiceNumber} ·{" "}
                              {new Date(
                                `${item.issueDate}T12:00:00`,
                              ).toLocaleDateString("pt-BR")}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 7 }}>
                            <Text
                              style={{
                                color: colors.text,
                                fontSize: 15,
                                fontWeight: "800",
                              }}
                            >
                              {money.format(item.totalValue)}
                            </Text>
                            <Ionicons
                              name={expanded ? "chevron-up" : "chevron-down"}
                              size={17}
                              color={brand.glow}
                            />
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <Tag
                            text={`${item.itemCount} ${item.itemCount === 1 ? "item" : "itens"}`}
                          />
                          {item.status && <Tag text={item.status} />}
                          {item.cfop && <Tag text={`CFOP ${item.cfop}`} />}
                        </View>
                      </Pressable>
                      {expanded && (
                        <View
                          style={{
                            paddingHorizontal: 16,
                            paddingBottom: 16,
                            gap: 9,
                            borderTopWidth: 1,
                            borderTopColor: colors.line,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.muted,
                              fontSize: 10,
                              fontWeight: "800",
                              letterSpacing: 1,
                              marginTop: 14,
                            }}
                          >
                            ITENS DA DANFE
                          </Text>
                          {item.items.map((invoiceItem, index) => (
                            <View
                              key={invoiceItem.id}
                              style={{
                                paddingVertical: 10,
                                borderBottomWidth:
                                  index === item.items.length - 1 ? 0 : 1,
                                borderBottomColor: colors.line,
                                gap: 6,
                              }}
                            >
                              <View style={{ flexDirection: "row", gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      color: colors.text,
                                      fontSize: 13,
                                      fontWeight: "700",
                                    }}
                                  >
                                    {invoiceItem.description}
                                  </Text>
                                  <Text
                                    style={{
                                      color: colors.muted,
                                      fontSize: 10,
                                      marginTop: 2,
                                    }}
                                  >
                                    {invoiceItem.category ?? "Sem categoria"}
                                  </Text>
                                </View>
                                <Text
                                  style={{
                                    color: colors.text,
                                    fontSize: 13,
                                    fontWeight: "800",
                                  }}
                                >
                                  {exactMoney.format(invoiceItem.totalCost)}
                                </Text>
                              </View>
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  gap: 7,
                                }}
                              >
                                <Tag
                                  text={`${invoiceItem.quantity?.toLocaleString("pt-BR") ?? "—"} ${invoiceItem.unit ?? ""}`.trim()}
                                />
                                {invoiceItem.unitCost != null && (
                                  <Tag
                                    text={`${exactMoney.format(invoiceItem.unitCost)} / ${invoiceItem.unit ?? "un."}`}
                                  />
                                )}
                                {invoiceItem.includedInCmv != null && (
                                  <Tag
                                    text={
                                      invoiceItem.includedInCmv
                                        ? "Entra no CMV"
                                        : "Fora do CMV"
                                    }
                                  />
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
            <Text
              style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}
            >
              Leitura somente para a casa autorizada · atualizada em{" "}
              {new Date(query.data.updatedAt).toLocaleString("pt-BR")}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 13,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.14)",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>
        {value}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}
function Tag({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: colors.soft,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>
        {text}
      </Text>
    </View>
  );
}
