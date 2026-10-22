import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
export const tokens = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: 22,
  touch: 48,
};
const palettes = {
  light: {
    bg: "#F3F6F4",
    surface: "rgba(255,255,255,0.88)",
    elevated: "#F9FBFA",
    glass: "rgba(255,255,255,0.68)",
    text: "#10251E",
    muted: "#64766E",
    accent: "#11664C",
    accentText: "#FFFFFF",
    line: "rgba(20,68,51,0.11)",
    soft: "rgba(17,102,76,0.09)",
    warning: "#805522",
    danger: "#C83E55",
    neon: "#12A979",
    auroraOne: "#61E7BB",
    auroraTwo: "#7A70FF",
  },
  dark: {
    bg: "#07110E",
    surface: "rgba(17,31,27,0.9)",
    elevated: "#101C18",
    glass: "rgba(24,44,37,0.62)",
    text: "#F3F8F5",
    muted: "#92A79F",
    accent: "#57E0B0",
    accentText: "#07130F",
    line: "rgba(196,255,232,0.1)",
    soft: "rgba(87,224,176,0.1)",
    warning: "#E8C68D",
    danger: "#FF7185",
    neon: "#57E0B0",
    auroraOne: "#0C8C67",
    auroraTwo: "#5348BB",
  },
};
type Mode = "system" | "light" | "dark";
const Context = createContext({
  colors: palettes.light,
  dark: false,
  mode: "system" as Mode,
  setMode: (_: Mode) => {},
});
export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [mode, setMode] = useState<Mode>("system");
  const system = useColorScheme();
  const dark = mode === "dark" || (mode === "system" && system === "dark");
  return (
    <Context.Provider
      value={{ colors: palettes[dark ? "dark" : "light"], dark, mode, setMode }}
    >
      {children}
    </Context.Provider>
  );
}
export const useTheme = () => useContext(Context);
