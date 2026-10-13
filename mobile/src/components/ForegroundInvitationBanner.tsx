import { useEffect, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PushInvitation } from "../services/pushPayload";
import { subscribeAndroidForegroundPush } from "../services/pushEvents";
import { useAppTheme } from "../theme/ThemeContext";

type Props = {
  onOpen: (invitation: PushInvitation) => void;
};

/**
 * Android release builds often suppress system heads-up notifications while the app
 * is open even when scheduleNotificationAsync succeeds. This in-app banner mirrors
 * background tray behavior for the foreground case.
 */
export default function ForegroundInvitationBanner({ onOpen }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [invitation, setInvitation] = useState<PushInvitation | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = subscribeAndroidForegroundPush((next) => {
      if (!next.surveyUrl || AppState.currentState !== "active") {
        return;
      }
      setInvitation(next);
    });

    return () => subscription.remove();
  }, []);

  if (Platform.OS !== "android" || !invitation?.surveyUrl) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          backgroundColor: isDark ? "#152238" : "#EBF4FF",
          borderBottomColor: isDark ? "#2D4A6F" : "#B6D4FE",
        },
      ]}
    >
      <Pressable
        style={styles.body}
        onPress={() => {
          onOpen(invitation);
          setInvitation(null);
        }}
      >
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {invitation.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={3}>
          {invitation.body}
        </Text>
        <Text style={[styles.action, { color: colors.link }]}>Tap to open survey</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Dismiss invitation"
        onPress={() => setInvitation(null)}
        style={styles.dismiss}
      >
        <Text style={[styles.dismissText, { color: colors.textSecondary }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  body: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  dismiss: {
    padding: 4,
  },
  dismissText: {
    fontSize: 18,
    lineHeight: 20,
  },
});
