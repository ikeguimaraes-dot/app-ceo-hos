import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "../ui/theme";
import { useGhost } from "../state/provider";
import {
  Button,
  Card,
  ErrorState,
  Label,
  Loading,
  Screen,
} from "../ui/components";

export function reservationDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
const statusNames: Record<string, string> = {
  confirmada: "Confirmada",
  pendente: "Pendente",
  cancelada: "Cancelada",
};
const originNames: Record<string, string> = {
  pagina: "Site",
  whatsapp: "WhatsApp",
  equipe: "Equipe",
  painel: "Painel",
  porta: "Porta",
  tagme_migrada: "Tagme",
};
export function ReservationsExperience() {
  const { state, gateways, controller } = useGhost();
  const { colors, dark } = useTheme();
  const cardTones = {
    confirmada: {
      backgroundColor: dark ? "#133B30" : "#E1F4EA",
      borderColor: dark ? "#287457" : "#A8D8BF",
      ink: dark ? "#8AF0C0" : "#166044",
    },
    pendente: {
      backgroundColor: dark ? "#3B3018" : "#FFF1CF",
      borderColor: dark ? "#806329" : "#E8CB82",
      ink: dark ? "#FFE09A" : "#785118",
    },
    cancelada: {
      backgroundColor: dark ? "#3D2028" : "#FCE5E9",
      borderColor: dark ? "#8A4053" : "#EBB2BF",
      ink: dark ? "#FFAABA" : "#9B314A",
    },
  };
  const toneFor = (status: string) =>
    cardTones[status as keyof typeof cardTones] ?? {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      ink: colors.text,
    };
  const [date, setDate] = useState(reservationDate);
  const units = (state.bootstrap?.units ?? []).filter((unit) =>
    unit.capabilities.includes("operation.read"),
  );
  const unit = units.find((item) => item.id === state.unitId);
  const session = state.session;
  const query = useQuery({
    queryKey: [
      "reservations",
      session?.userId,
      unit?.id,
      date,
      state.generation,
    ],
    queryFn: ({ signal }) =>
      gateways.reservations.get(
        { session: session!, unitId: unit!.id, signal },
        date,
      ),
    enabled: !!session && !!unit,
    refetchInterval: 60_000,
  });
  const shift = (days: number) => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    setDate(next.toISOString().slice(0, 10));
  };
  return (
    <Screen title="Reservas por casa" subtitle="Serena · agenda de reservas">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {units.map((item) => (
          <Button
            key={item.id}
            title={item.name}
            secondary={unit?.id !== item.id}
            onPress={() => void controller.selectUnit(item.id)}
          />
        ))}
      </ScrollView>
      {!unit ? (
        <Label muted>
          Selecione uma casa autorizada para consultar as reservas.
        </Label>
      ) : (
        <>
          <Card>
            <Label size={22}>{unit.name}</Label>
            <Label>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "America/Sao_Paulo",
              })}
            </Label>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Anterior" secondary onPress={() => shift(-1)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Hoje"
                  secondary
                  onPress={() => setDate(reservationDate())}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Próximo" secondary onPress={() => shift(1)} />
              </View>
            </View>
          </Card>
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorState
              message={query.error.message}
              retry={() => void query.refetch()}
            />
          ) : !query.data.connected ? (
            <Card>
              <Label>Casa ainda não conectada ao Serena</Label>
              <Label muted>As reservas desta casa não estão disponíveis.</Label>
            </Card>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Card
                  style={{
                    flex: 1,
                    backgroundColor: dark ? "#123B34" : "#D7F1E6",
                    borderColor: dark ? "#287457" : "#A8D8BF",
                  }}
                >
                  <Label muted>RESERVAS ATIVAS</Label>
                  <Label size={32}>{query.data.total}</Label>
                </Card>
                <Card
                  style={{
                    flex: 1,
                    backgroundColor: dark ? "#272644" : "#EAE5FC",
                    borderColor: dark ? "#5D5689" : "#CDC1EF",
                  }}
                >
                  <Label muted>PESSOAS PREVISTAS</Label>
                  <Label size={32}>{query.data.guests}</Label>
                </Card>
              </View>
              <Label muted>
                {query.data.confirmed} confirmadas · {query.data.pending}{" "}
                pendentes · {query.data.cancelled} canceladas
              </Label>
              {!query.data.items.length ? (
                <Card>
                  <Label>Nenhuma reserva nesta data.</Label>
                </Card>
              ) : (
                query.data.items.map((item) => (
                  <Card
                    key={item.id}
                    style={{
                      backgroundColor: toneFor(item.status).backgroundColor,
                      borderColor: toneFor(item.status).borderColor,
                      borderLeftWidth: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 22,
                        lineHeight: 29,
                        fontWeight: "700",
                      }}
                    >
                      {item.guestName?.trim() || "Nome não informado"}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Label size={24}>
                        {item.time?.slice(0, 5) ?? "Sem horário"}
                      </Label>
                      <View
                        style={{
                          borderRadius: 20,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          backgroundColor: dark ? "#00000025" : "#FFFFFF99",
                          alignSelf: "center",
                          flexShrink: 1,
                        }}
                      >
                        <Text
                          style={{
                            color: toneFor(item.status).ink,
                            fontWeight: "700",
                            fontSize: 13,
                          }}
                        >
                          {statusNames[item.status] ?? item.status}
                        </Text>
                      </View>
                    </View>
                    <Label>
                      {item.guests} pessoas
                      {item.table ? ` · Mesa ${item.table}` : ""}
                    </Label>
                    {item.origin && (
                      <Label muted>
                        {originNames[item.origin] ?? item.origin}
                      </Label>
                    )}
                  </Card>
                ))
              )}
              <Label muted size={12}>
                Atualizado em{" "}
                {new Date(query.data.updatedAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}{" "}
                · horário de Brasília
              </Label>
              <Button
                title={query.isFetching ? "Atualizando…" : "Atualizar reservas"}
                secondary
                disabled={query.isFetching}
                onPress={() => void query.refetch()}
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
