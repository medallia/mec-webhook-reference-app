import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getErrorMessage, registerDevice } from "../services/api";
import {
  getFcmToken,
  getPlatform,
  hasNotificationPermission,
  requestNotificationPermissions,
} from "../services/notifications";
import { saveContactId, setPushServerOptIn } from "../services/storage";
import { DISMISS_WITHOUT_REGISTRATION_ALERT } from "../constants/registerCopy";
import type { RootStackParamList } from "../navigation/AppNavigator";
import MedalliaLogo from "../components/MedalliaLogo";
import PrivacyPolicyFooter from "../components/PrivacyPolicyFooter";
import { useAppTheme } from "../theme/ThemeContext";
import type { AppColors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

const KEYBOARD_SCROLL_PADDING = 24;

function createStyles(colors: AppColors, isDark: boolean) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 24,
      backgroundColor: colors.background,
      flexGrow: 1,
    },
    containerWithKeyboard: {
      flexGrow: 0,
    },
    content: {
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 16,
      color: colors.text,
    },
    infoCard: {
      backgroundColor: isDark ? "#152238" : "#EBF4FF",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? "#2D4A6F" : "#B6D4FE",
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: isDark ? colors.link : colors.primary,
      marginBottom: 6,
    },
    infoText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 8,
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.inputBackground,
      color: colors.inputText,
      marginBottom: 20,
    },
    consentRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
      paddingVertical: 8,
    },
    switchContainer: {
      marginRight: 8,
    },
    consentTextContainer: {
      flex: 1,
      flexShrink: 1,
    },
    consentText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 12,
    },
    buttonDisabled: {
      backgroundColor: isDark ? colors.border : "#BCCCDC",
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: "600",
      fontSize: 16,
    },
    cancelButton: {
      alignItems: "center",
      paddingVertical: 12,
    },
    cancelButtonText: {
      color: colors.link,
      fontWeight: "600",
      fontSize: 15,
    },
  });
}

export default function RegisterScreen({ navigation }: Props) {
  const headerHeight = useHeaderHeight();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const scrollRef = useRef<ScrollView>(null);
  const formScrollYRef = useRef(0);
  const formHeightRef = useRef(0);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [contactId, setContactId] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [osNotificationsEnabled, setOsNotificationsEnabled] = useState(false);

  const refreshOsNotificationPermission = useCallback(async (): Promise<void> => {
    if (Platform.OS !== "ios") {
      return;
    }
    setOsNotificationsEnabled(await hasNotificationPermission());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshOsNotificationPermission();
    }, [refreshOsNotificationPermission]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshOsNotificationPermission();
      }
    });
    return () => subscription.remove();
  }, [refreshOsNotificationPermission]);

  const scrollFormAboveKeyboard = useCallback(
    (keyboardTopOnScreen: number) => {
      const visibleHeight = Math.max(0, keyboardTopOnScreen - headerHeight);
      const formBottom = formScrollYRef.current + formHeightRef.current;
      const targetY = formBottom - visibleHeight + KEYBOARD_SCROLL_PADDING;

      scrollRef.current?.scrollTo({
        y: Math.max(0, targetY),
        animated: true,
      });
    },
    [headerHeight],
  );

  const handleKeyboardShow = useCallback(
    (event: KeyboardEvent) => {
      const { screenY, height } = event.endCoordinates;
      setKeyboardInset(height);

      if (Platform.OS === "ios") {
        scrollFormAboveKeyboard(screenY);
        setTimeout(() => scrollFormAboveKeyboard(screenY), 100);
      }
    },
    [scrollFormAboveKeyboard],
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [handleKeyboardShow]);

  useEffect(() => {
    if (Platform.OS === "android" && keyboardInset > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    }
  }, [keyboardInset]);

  const scrollFormIntoView = useCallback(() => {
    if (Platform.OS === "android") {
      return;
    }

    const metrics = Keyboard.metrics();
    if (metrics && metrics.height > 0) {
      scrollFormAboveKeyboard(metrics.screenY);
      return;
    }

    scrollRef.current?.scrollTo({
      y: Math.max(0, formScrollYRef.current - KEYBOARD_SCROLL_PADDING),
      animated: true,
    });
  }, [scrollFormAboveKeyboard]);

  function validateForm(): string | null {
    const trimmed = contactId.trim();
    if (!trimmed) {
      Alert.alert("Contact ID required", "Enter the email or contact ID used by your Medallia distribution.");
      return null;
    }

    if (!consentGiven) {
      Alert.alert("Consent required", "Please review and accept the data collection terms before registering.");
      return null;
    }

    return trimmed;
  }

  function navigateToHome(): void {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Home");
    }
  }

  async function registerWithPushToken(trimmed: string): Promise<void> {
    const fcmToken = await getFcmToken(trimmed);
    await registerDevice({
      contactId: trimmed,
      fcmToken,
      platform: getPlatform(),
      locale: "en-US",
    });
    await setPushServerOptIn(true);
    await saveContactId(trimmed);
    navigateToHome();
  }

  function showDismissWithoutRegistrationAlert(): Promise<void> {
    return new Promise((resolve) => {
      Alert.alert(
        DISMISS_WITHOUT_REGISTRATION_ALERT.title,
        DISMISS_WITHOUT_REGISTRATION_ALERT.message,
        [
          {
            text: DISMISS_WITHOUT_REGISTRATION_ALERT.ok,
            onPress: () => {
              navigateToHome();
              resolve();
            },
          },
        ],
      );
    });
  }

  async function dismissWithoutRegistration(): Promise<void> {
    await showDismissWithoutRegistrationAlert();
  }

  async function handleRegister(): Promise<void> {
    const trimmed = validateForm();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    try {
      await registerWithPushToken(trimmed);
    } catch (error) {
      Alert.alert("Registration failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableNotificationsAndRegister(): Promise<void> {
    const trimmed = validateForm();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    try {
      let granted = await hasNotificationPermission();
      if (!granted) {
        granted = await requestNotificationPermissions();
      }
      await refreshOsNotificationPermission();

      if (!granted) {
        Alert.alert(
          "Notifications not enabled",
          "Turn on notifications for Webhook Invites in Settings, or continue without push and enable them later from the home screen.",
          [
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
            {
              text: "Continue without notifications",
              onPress: () => {
                void (async () => {
                  setLoading(true);
                  try {
                    await dismissWithoutRegistration();
                  } finally {
                    setLoading(false);
                  }
                })();
              },
            },
          ],
        );
        return;
      }

      await registerWithPushToken(trimmed);
    } catch (error) {
      Alert.alert("Registration failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      enabled={Platform.OS === "ios"}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          keyboardInset > 0 && styles.containerWithKeyboard,
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        <View style={styles.content}>
          {keyboardInset === 0 ? (
            <>
              <MedalliaLogo size={80} />
              <Text style={styles.title}>
                {Platform.OS === "ios" ? "Link Your Contact" : "Enable Personalized Alerts"}
              </Text>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Why we need this</Text>
                <Text style={styles.infoText}>
                  {Platform.OS === "ios"
                    ? "Enter your email or contact ID to link this device to your client profile. Notifications are optional—you can explore the app or open a sample survey without enabling them."
                    : "Enter your email or contact ID to link this device to your client profile. This enables Medallia to route personalized survey invitations directly to you via push notifications."}
                </Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>What we collect</Text>
                <Text style={styles.infoText}>
                  {Platform.OS === "ios"
                    ? "• Your email or contact ID\n• A push notification token only if you choose to enable notifications\n\nData is stored securely and used for notification routing. You can delete your data at any time from the app."
                    : "• Your email or contact ID\n• Your device push notification token\n\nThis data is stored securely in our cloud and used solely for push notification routing. You can delete your data at any time from the app."}
                </Text>
              </View>
            </>
          ) : null}

          <View
            collapsable={false}
            onLayout={(event) => {
              formScrollYRef.current = event.nativeEvent.layout.y;
              formHeightRef.current = event.nativeEvent.layout.height;
            }}
          >
            <Text style={styles.label}>Email or Contact ID</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              value={contactId}
              onChangeText={setContactId}
              onFocus={scrollFormIntoView}
            />

            <View style={styles.consentRow}>
              <View style={styles.switchContainer}>
                <Switch
                  value={consentGiven}
                  onValueChange={setConsentGiven}
                  trackColor={{
                    false: isDark ? colors.border : "#D9E2EC",
                    true: isDark ? "#3D6BB3" : "#9DC2FF",
                  }}
                  thumbColor={consentGiven ? colors.primary : isDark ? colors.label : "#BCCCDC"}
                />
              </View>
              <Pressable
                style={styles.consentTextContainer}
                onPress={() => setConsentGiven((current) => !current)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentGiven }}
              >
                <Text style={styles.consentText}>
                  I understand and consent to this data collection for notification routing.
                </Text>
              </Pressable>
            </View>

            {Platform.OS === "ios" && osNotificationsEnabled ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Notifications are on</Text>
                <Text style={styles.infoText}>
                  Tap Enable Personalized Alerts below to register this device and receive live survey invitations.
                  Your contact ID is sent to our servers only when you complete registration.
                </Text>
              </View>
            ) : null}

            {Platform.OS === "ios" ? (
              <>
                <Pressable
                  style={[styles.button, (!consentGiven || !contactId.trim()) && styles.buttonDisabled]}
                  onPress={handleEnableNotificationsAndRegister}
                  disabled={loading || !consentGiven || !contactId.trim()}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>
                      {osNotificationsEnabled ? "Enable Personalized Alerts" : "Enable notifications & register"}
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.button, (!consentGiven || !contactId.trim()) && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading || !consentGiven || !contactId.trim()}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Register Device</Text>
                )}
              </Pressable>
            )}

            <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>

          <PrivacyPolicyFooter />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
