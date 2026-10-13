import Constants from "expo-constants";

export interface AppConfig {
  apiBaseUrl: string;
  apiKey: string;
  privacyPolicyUrl: string;
}

export function getAppConfig(): AppConfig {
  const extra = Constants.expoConfig?.extra ?? {};

  return {
    apiBaseUrl: String(extra.apiBaseUrl ?? ""),
    apiKey: String(extra.apiKey ?? ""),
    privacyPolicyUrl: String(extra.privacyPolicyUrl ?? "https://www.medallia.com/legal/privacy-policy/"),
  };
}
