import { Image } from "react-native";
import { useTheme } from "./theme";

export function BrandLogo() {
  const { colors, dark } = useTheme();
  return (
    <Image
      source={require("../../assets/ceo-de-bolso-logo-transparent.png")}
      accessibilityLabel="CEO de bolso"
      resizeMode="contain"
      style={{ width: 154, height: 74, tintColor: dark ? colors.text : undefined }}
    />
  );
}
