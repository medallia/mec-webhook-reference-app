import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  deleteDevice,
  getErrorMessage,
  registerDevice,
} from "../services/api";
import { DEMO_SURVEY_URL } from "../constants/demoSurvey";
import {
  clearPushInvitationHandlers,
  getFcmToken,
  getFcmTokenIfPermitted,
  getPlatform,
  hasNotificationPermission,
  isSimulatorPushBypassActive,
  requestNotificationPermissions,
  setPushInvitationHandlers,
} from "../services/notifications";
import {
  clearAllData,
  getContactId,
  getPushServerOptIn,
  setPushServerOptIn,
} from "../services/storage";
import type { RootStackParamList } from "../navigation/AppNavigator";
import MedalliaLogo from "../components/MedalliaLogo";
import PushDiagnosticsPanel, {
  enablePushDiagnosticsFromGesture,
  usePushDiagnosticsVisible,
} from "../components/PushDiagnosticsPanel";
import PrivacyPolicyFooter from "../components/PrivacyPolicyFooter";
import { useAppTheme } from "../theme/ThemeContext";
import type { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function createStyles(colors: AppColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      padding: 24,
      backgroundColor: colors.background,
      flexGrow: 1,
    },
    content: {
      flexGrow: 1,
    },
    demoCard: {
      backgroundColor: isDark ? "#152238" : "#EBF4FF",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? "#2D4A6F" : "#B6D4FE",
    },
    demoTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: isDark ? colors.link : colors.primary,
      marginBottom: 6,
    },
    demoText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    noticeBanner: {
      backgroundColor: isDark ? "#3D3520" : "#FFF3C4",
      borderRadius: 10,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? "#6B5A20" : "#F0D861",
    },
    noticeText: {
      color: colors.simulatorNotice,
      fontSize: 13,
      lineHeight: 19,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.label,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    value: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    help: {
      color: colors.textSecondary,
      lineHeight: 21,
    },
    simulatorNotice: {
      color: colors.simulatorNotice,
      lineHeight: 21,
      marginTop: 12,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 12,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: "600",
      fontSize: 16,
    },
    destructiveButton: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#E12D39",
      marginBottom: 8,
    },
    destructiveButtonText: {
      color: "#E12D39",
      fontWeight: "600",
      fontSize: 15,
    },
    clearHint: {
      color: colors.meta,
      fontSize: 12,
      textAlign: "center",
      lineHeight: 18,
      marginBottom: 16,
    },
    secondaryButton: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 16,
    },
  });
}

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [serverPushOptIn, setServerPushOptIn] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(null);

  const syncPushPermission = useCallback(async (): Promise<void> => {
    setPushEnabled(await hasNotificationPermission());
  }, []);

  const refreshRegistration = useCallback(async (storedContactId: string): Promise<void> => {
    try {
      if (!(await getPushServerOptIn())) {
        setRegistrationNotice(null);
        return;
      }

      if (Platform.OS === "ios") {
        if (!(await hasNotificationPermission())) {
          setRegistrationNotice(null);
          return;
        }

        const fcmToken = await getFcmTokenIfPermitted(storedContactId);
        if (!fcmToken) {
          setRegistrationNotice(
            "Notifications are on, but this device has not finished push setup yet. Tap below to register with the server.",
          );
          return;
        }

        await registerDevice({
          contactId: storedContactId,
          fcmToken,
          platform: getPlatform(),
        });
        setRegistrationNotice(null);
        return;
      }

      const fcmToken = await getFcmToken(storedContactId);
      await registerDevice({
        contactId: storedContactId,
        fcmToken,
        platform: getPlatform(),
      });
      setRegistrationNotice(null);
    } catch (error) {
      setRegistrationNotice(
        `Unable to refresh device registration. ${getErrorMessage(error)}`,
      );
    }
  }, []);

  const loadHomeState = useCallback(async (): Promise<void> => {
    const storedContactId = await getContactId();
    if (!storedContactId) {
      setContactId(null);
      setRegistrationNotice(null);
      setPushEnabled(false);
      setServerPushOptIn(false);
      return;
    }

    setContactId(storedContactId);
    setServerPushOptIn(await getPushServerOptIn());
    await syncPushPermission();
    await refreshRegistration(storedContactId);
  }, [refreshRegistration, syncPushPermission]);

  useEffect(() => {
    void loadHomeState();
  }, [loadHomeState]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      void loadHomeState();
    });
    return unsubscribe;
  }, [navigation, loadHomeState]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void loadHomeState();
      }
    });
    return () => subscription.remove();
  }, [loadHomeState]);

  function openSampleSurvey(): void {
    navigation.navigate("Survey", {
      surveyUrl: DEMO_SURVEY_URL,
      title: "Sample survey",
    });
  }

  async function handleEnableNotifications(): Promise<void> {
    if (!contactId) {
      return;
    }

    setEnablingPush(true);
    try {
      const granted = await requestNotificationPermissions();
      await syncPushPermission();
      if (!granted) {
        Alert.alert(
          "Notifications not enabled",
          "Turn on notifications for Webhook Invites in Settings, then return here and tap Enable notifications again.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }

      const fcmToken = await getFcmToken(contactId);
      await registerDevice({
        contactId,
        fcmToken,
        platform: getPlatform(),
        locale: "en-US",
      });
      await setPushServerOptIn(true);
      setServerPushOptIn(true);
      await syncPushPermission();
      setRegistrationNotice(null);
    } catch (error) {
      Alert.alert("Registration failed", getErrorMessage(error));
    } finally {
      setEnablingPush(false);
    }
  }

  useEffect(() => {
    setPushInvitationHandlers({
      onTokenRefresh: (token) => {
        void (async () => {
          const storedContactId = await getContactId();
          if (!storedContactId || !(await getPushServerOptIn())) {
            return;
          }
          try {
            await registerDevice({
              contactId: storedContactId,
              fcmToken: token,
              platform: getPlatform(),
            });
          } catch (error) {
            console.warn("FCM token refresh registration failed:", error);
          }
        })();
      },
    });

    return () => {
      clearPushInvitationHandlers(["onTokenRefresh"]);
    };
  }, []);

  async function handleClearData(): Promise<void> {
    if (!contactId) return;

    Alert.alert(
      "Clear My Data",
      "This will remove your device registration from the server and clear all local data. You will stop receiving push notifications.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await deleteDevice(contactId);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Server delete failed";
              console.warn("Server-side device delete failed:", message);
            }
            await clearAllData();
            setContactId(null);
            setServerPushOptIn(false);
            setClearing(false);
            Alert.alert("Data Cleared", "Your device registration and local data have been removed.");
          },
        },
      ],
    );
  }

  const isRegistered = contactId !== null;
  const pushDiagnosticsVisible = usePushDiagnosticsVisible();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.content}>
        <MedalliaLogo size={80} />

        {pushDiagnosticsVisible ? <PushDiagnosticsPanel /> : null}

        <View style={styles.demoCard}>
          <Pressable
            onLongPress={() => {
              if (Platform.OS === "android") {
                void enablePushDiagnosticsFromGesture();
              }
            }}
            delayLongPress={800}
          >
            <Text style={styles.demoTitle}>Medallia Webhook Invitations</Text>
          </Pressable>
          <Text style={styles.demoText}>
            {Platform.OS === "ios"
              ? "Reference app for Medallia webhook push invitations. Explore a sample survey anytime, or optionally enable notifications to receive live invitations."
              : "Receive personalized survey invitations on your device via push notifications. Register your device, get real-time invitations, and provide feedback."}
          </Text>
        </View>

        {registrationNotice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>{registrationNotice}</Text>
          </View>
        ) : null}

        {isRegistered ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Saved contact</Text>
              <Text style={styles.value}>{contactId}</Text>
              <Text style={styles.help}>
                {Platform.OS === "ios" && !serverPushOptIn
                  ? "Complete registration below to link this device for live survey invitations."
                  : Platform.OS === "ios" && !pushEnabled
                    ? "Notifications are off. Enable them below to receive live survey invitations for this contact."
                    : "Medallia distributions sent for this contact will be delivered to this device."}
              </Text>
              {isSimulatorPushBypassActive() ? (
                <Text style={styles.simulatorNotice}>
                  Running on a simulator with a mock push token. Registration and survey flows work,
                  but real push notifications require a physical device.
                </Text>
              ) : null}
            </View>

            {Platform.OS === "ios" && !serverPushOptIn ? (
              <Pressable
                style={styles.button}
                onPress={() => void handleEnableNotifications()}
                disabled={enablingPush}
              >
                {enablingPush ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>
                    {pushEnabled ? "Enable Personalized Alerts" : "Enable notifications"}
                  </Text>
                )}
              </Pressable>
            ) : null}

            {Platform.OS === "ios" ? (
              <Pressable style={styles.secondaryButton} onPress={openSampleSurvey}>
                <Text style={styles.secondaryButtonText}>View sample survey</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.destructiveButton}
              onPress={handleClearData}
              disabled={clearing}
            >
              <Text style={styles.destructiveButtonText}>
                {clearing ? "Clearing..." : "Clear My Data"}
              </Text>
            </Pressable>
            <Text style={styles.clearHint}>
              Removes your device registration from the server and clears all local data.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Get Started</Text>
              <Text style={styles.help}>
                {Platform.OS === "ios"
                  ? "Link your contact ID to try the reference flow, or open a sample survey without registering."
                  : "Register your device to receive personalized survey invitations via push notifications."}
              </Text>
            </View>

            {Platform.OS === "ios" ? (
              <Pressable style={styles.secondaryButton} onPress={openSampleSurvey}>
                <Text style={styles.secondaryButtonText}>View sample survey</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.button}
              onPress={() => navigation.navigate("Register")}
            >
              <Text style={styles.buttonText}>
                {Platform.OS === "ios" ? "Link contact ID" : "Enable Personalized Alerts"}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <PrivacyPolicyFooter />
    </ScrollView>
  );
}
