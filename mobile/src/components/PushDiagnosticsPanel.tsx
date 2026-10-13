import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  clearPushDiagnosticEntries,
  getPushDiagnosticEntries,
  isPushDiagnosticsEnabled,
  loadPushDiagnosticsUnlock,
  recordPushDiagnostic,
  setPushDiagnosticsUnlocked,
  subscribePushDiagnostics,
  type PushDiagnosticEntry,
} from "../services/pushDiagnostics";
import { isAndroidForegroundHandlersRegistered } from "../services/pushMessagingBootstrap";
import { useAppTheme } from "../theme/ThemeContext";

export function usePushDiagnosticsVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void loadPushDiagnosticsUnlock().then(setVisible);
    const sub = subscribePushDiagnostics(() => {
      void loadPushDiagnosticsUnlock().then(setVisible);
    });
    return () => sub.remove();
  }, []);

  return visible;
}

/** Long-press the Home demo title on Android to enable without logcat. */
export async function enablePushDiagnosticsFromGesture(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await setPushDiagnosticsUnlocked(true);
  recordPushDiagnostic("diagnostics_enabled", {
    handlersRegistered: isAndroidForegroundHandlersRegistered(),
  });
  AlertFromGesture();
}

function AlertFromGesture(): void {
  Alert.alert(
    "Push diagnostics on",
    "Send a test invitation with the app open. Events appear below and errors show as alerts.",
  );
}

type Props = {
  onDisable?: () => void;
};

export default function PushDiagnosticsPanel({ onDisable }: Props) {
  const { colors, isDark } = useAppTheme();
  const [entries, setEntries] = useState<PushDiagnosticEntry[]>([]);

  const refresh = useCallback(() => {
    setEntries(getPushDiagnosticEntries());
  }, []);

  useEffect(() => {
    refresh();
    const sub = subscribePushDiagnostics(refresh);
    return () => sub.remove();
  }, [refresh]);

  if (!isPushDiagnosticsEnabled()) {
    return null;
  }

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: isDark ? "#1a2332" : "#f4f6f8",
          borderColor: isDark ? "#3d4f66" : "#c5cdd6",
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Push diagnostics (Android)</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Foreground: expect on_message → delivered. expo_received + deliver_skipped_dedupe is
        normal (same invite twice). If delivered but no tray, use the in-app banner at the top.
      </Text>
      <View style={styles.row}>
        <Pressable onPress={refresh} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Refresh</Text>
        </Pressable>
        <Pressable onPress={() => clearPushDiagnosticEntries()} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Clear</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void setPushDiagnosticsUnlocked(false).then(() => onDisable?.());
          }}
          style={styles.smallButton}
        >
          <Text style={styles.smallButtonText}>Hide</Text>
        </Pressable>
      </View>
      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>No events yet.</Text>
      ) : (
        entries.map((entry, index) => (
          <Text
            key={`${entry.at}-${index}`}
            style={[styles.line, { color: colors.textSecondary }]}
            selectable
          >
            {entry.at.slice(11, 19)} {entry.event}
            {entry.detail ? ` — ${entry.detail}` : ""}
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1F4FD8",
  },
  smallButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    fontSize: 12,
  },
  line: {
    fontSize: 11,
    fontFamily: Platform.OS === "android" ? "monospace" : "Menlo",
    marginBottom: 4,
  },
});
