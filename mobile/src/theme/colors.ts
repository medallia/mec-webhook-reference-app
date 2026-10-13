import type { ColorSchemeName } from "react-native";

export type AppColors = {
  background: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  label: string;
  meta: string;
  simulatorNotice: string;
  inputBackground: string;
  inputText: string;
  placeholder: string;
  primary: string;
  onPrimary: string;
  link: string;
};

export const lightColors: AppColors = {
  background: "#F7F9FC",
  card: "#FFFFFF",
  border: "#D9E2EC",
  text: "#102A43",
  textSecondary: "#486581",
  label: "#627D98",
  meta: "#829AB1",
  simulatorNotice: "#8D6E00",
  inputBackground: "#FFFFFF",
  inputText: "#102A43",
  placeholder: "#829AB1",
  primary: "#1F4FD8",
  onPrimary: "#FFFFFF",
  link: "#1F4FD8",
};

export const darkColors: AppColors = {
  background: "#0B1220",
  card: "#1A2332",
  border: "#334E68",
  text: "#F0F4F8",
  textSecondary: "#9FB3C8",
  label: "#829AB1",
  meta: "#627D98",
  simulatorNotice: "#F5D90A",
  inputBackground: "#243B53",
  inputText: "#F0F4F8",
  placeholder: "#627D98",
  primary: "#1F4FD8",
  onPrimary: "#FFFFFF",
  link: "#6B9BFF",
};

export function getColors(colorScheme: ColorSchemeName | null | undefined): AppColors {
  return colorScheme === "dark" ? darkColors : lightColors;
}
