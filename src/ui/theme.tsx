import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
export const tokens = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: 18,
  touch: 48,
};
const palettes = {
  light: {
    bg: "#F5F4F0",
    surface: "#FFFFFF",
    text: "#192921",
    muted: "#617067",
    accent: "#234F3D",
    accentText: "#FFFFFF",
    line: "#DFE4DC",
    soft: "#E9EEE6",
    warning: "#805522",
  },
  dark: {
    bg: "#101A15",
    surface: "#1B2A22",
    text: "#F0F3E9",
    muted: "#AFBEB3",
    accent: "#B7D4AC",
    accentText: "#14231A",
    line: "#34493C",
    soft: "#263C2D",
    warning: "#E8C68D",
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
