import { Image } from "react-native";

export function BrandLogo() {
  return (
    <Image
      source={require("../../assets/ceo-de-bolso-logo.png")}
      accessibilityLabel="CEO de bolso"
      resizeMode="cover"
      style={{ width: 154, height: 74, borderRadius: 14, backgroundColor: "#FFFFFF" }}
    />
  );
}
