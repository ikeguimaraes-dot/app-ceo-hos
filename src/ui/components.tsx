import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./theme";
import { environment } from "../config/environment";
export function Label({
  children,
  muted = false,
  size = 16,
}: React.PropsWithChildren<{ muted?: boolean; size?: number }>) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: muted ? colors.muted : colors.text,
        fontSize: size,
        lineHeight: size * 1.45,
      }}
    >
      {children}
    </Text>
  );
}
export function Heading({ children }: React.PropsWithChildren) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontSize: 32,
        fontWeight: "600",
        letterSpacing: -1,
        color: colors.text,
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 14,
        padding: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? colors.soft : colors.accent,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: secondary ? colors.text : colors.accentText,
          fontWeight: "600",
          fontSize: 15,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          padding: 20,
          borderRadius: 20,
          backgroundColor: colors.surface,
          gap: 12,
          borderWidth: 1,
          borderColor: colors.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Screen({
  children,
  title,
  subtitle,
}: React.PropsWithChildren<{ title: string; subtitle?: string }>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          gap: 20,
          maxWidth: 680,
          width: "100%",
          alignSelf: "center",
          paddingBottom: 48,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: colors.accent,
              fontSize: 24,
              fontWeight: "700",
              letterSpacing: -1,
            }}
          >
            ghost<Text style={{ color: colors.muted }}> ·</Text>
          </Text>
          <Text
            style={{ fontSize: 10, letterSpacing: 1.5, color: colors.muted }}
          >
            {environment.isRemote
              ? `${environment.appEnvironment.toUpperCase()} · REMOTO`
              : "DEMONSTRAÇÃO LOCAL"}
          </Text>
        </View>
        <View style={{ gap: 8, marginTop: 12 }}>
          <Heading>{title}</Heading>
          {!!subtitle && <Label muted>{subtitle}</Label>}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Label size={14}>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={{
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 12,
          padding: 14,
          minHeight: 50,
          color: colors.text,
          backgroundColor: colors.surface,
          fontSize: 16,
        }}
      />
    </View>
  );
}
export function Loading() {
  return (
    <Card>
      <ActivityIndicator accessibilityLabel="Carregando" />
      <Label muted>Preparando sua perspectiva…</Label>
    </Card>
  );
}
export function Empty({ text = "Tudo em dia por aqui." }: { text?: string }) {
  return (
    <Card>
      <Label size={22}>Um pouco de tranquilidade.</Label>
      <Label muted>{text}</Label>
    </Card>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <Card>
      <Text
        accessibilityRole="alert"
        style={{ color: useTheme().colors.warning }}
      >
        {message}
      </Text>
      <Button title="Tentar novamente" onPress={retry} secondary />
    </Card>
  );
}
