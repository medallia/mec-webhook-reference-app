import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import type { AppColors } from "./colors";

export function createNavigationTheme(colors: AppColors, isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };
}
