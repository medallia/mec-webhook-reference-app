import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, DeviceEventEmitter, Platform } from "react-native";

const STORAGE_KEY = "mec:push-diagnostics-unlocked";
const MAX_EVENTS = 20;

export const PUSH_DIAGNOSTICS_UPDATED_EVENT = "mec:push-diagnostics-updated";

export type PushDiagnosticEntry = {
  at: string;
  event: string;
  detail?: string;
};

const entries: PushDiagnosticEntry[] = [];
let unlocked = false;
let unlockLoaded = false;

function envDiagnosticsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PUSH_DIAGNOSTICS === "true";
}

export function isPushDiagnosticsEnabled(): boolean {
  if (Platform.OS !== "android") {
    return false;
  }
  return envDiagnosticsEnabled() || unlocked;
}

async function ensureUnlockLoaded(): Promise<void> {
  if (unlockLoaded) {
    return;
  }
  unlockLoaded = true;
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    unlocked = value === "1";
  } catch {
    unlocked = false;
  }
}

export async function setPushDiagnosticsUnlocked(enabled: boolean): Promise<void> {
  await ensureUnlockLoaded();
  unlocked = enabled;
  try {
    if (enabled) {
      await AsyncStorage.setItem(STORAGE_KEY, "1");
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  DeviceEventEmitter.emit(PUSH_DIAGNOSTICS_UPDATED_EVENT);
}

export async function loadPushDiagnosticsUnlock(): Promise<boolean> {
  await ensureUnlockLoaded();
  return isPushDiagnosticsEnabled();
}

function formatDetail(detail?: Record<string, unknown>): string | undefined {
  if (!detail || Object.keys(detail).length === 0) {
    return undefined;
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function emitUpdate(): void {
  DeviceEventEmitter.emit(PUSH_DIAGNOSTICS_UPDATED_EVENT);
}

const ALERT_EVENTS = new Set([
  "missing_survey_url",
  "present_failed",
  "handlers_register_failed",
]);

export function recordPushDiagnostic(event: string, detail?: Record<string, unknown>): void {
  void ensureUnlockLoaded().then(() => {
    if (!isPushDiagnosticsEnabled()) {
      return;
    }

    const entry: PushDiagnosticEntry = {
      at: new Date().toISOString(),
      event,
      detail: formatDetail(detail),
    };
    entries.unshift(entry);
    while (entries.length > MAX_EVENTS) {
      entries.pop();
    }
    emitUpdate();

    if (ALERT_EVENTS.has(event)) {
      const body = entry.detail ? `${event}\n${entry.detail}` : event;
      Alert.alert("Push diagnostics", body);
    }
  });
}

export function getPushDiagnosticEntries(): PushDiagnosticEntry[] {
  return [...entries];
}

export function clearPushDiagnosticEntries(): void {
  entries.length = 0;
  emitUpdate();
}

export function subscribePushDiagnostics(listener: () => void): { remove: () => void } {
  const subscription = DeviceEventEmitter.addListener(PUSH_DIAGNOSTICS_UPDATED_EVENT, listener);
  return { remove: () => subscription.remove() };
}
