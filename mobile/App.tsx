import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  addNotificationResponseListener,
  clearPushInvitationHandlers,
  configurePushNotifications,
  extractInvitationFromNotification,
  initializeFirebaseMessaging,
  setPushInvitationHandlers,
} from "./src/services/notifications";
import { acknowledgeDelivery } from "./src/services/api";
import { Alert, AppState, Linking, Platform, Settings } from "react-native";
import { NavigationContainer, type NavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import ForegroundInvitationBanner from "./src/components/ForegroundInvitationBanner";
import AppNavigator, { type RootStackParamList } from "./src/navigation/AppNavigator";
import type { PushInvitation } from "./src/services/pushPayload";
import { getContactId } from "./src/services/storage";
import { ThemeProvider, useAppTheme } from "./src/theme/ThemeContext";
import { createNavigationTheme } from "./src/theme/navigation";

function parseSurveyDeepLink(url: string): { surveyUrl: string; messageId?: string } | null {
  try {
    if (!url.startsWith("distributionwebhook://survey")) return null;
    const parsed = new URL(url);
    const surveyUrl = parsed.searchParams.get("url");
    if (!surveyUrl) return null;
    return {
      surveyUrl: decodeURIComponent(surveyUrl),
      messageId: parsed.searchParams.get("messageId") ?? undefined,
    };
  } catch {
    return null;
  }
}

// Max age in seconds for a pending survey entry — anything older is stale and ignored
const PENDING_SURVEY_MAX_AGE_S = 15;

function clearPendingSurveyDefaults() {
  if (Platform.OS !== "ios") return;
  Settings.set({
    pendingSurveyUrl: null,
    pendingMessageId: null,
    pendingSurveyTimestamp: null,
  });
}

function AppContent() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const navigationReady = useRef(false);
  const handledMessageIds = useRef<Set<string>>(new Set());
  const { colors, isDark } = useAppTheme();
  const navigationTheme = useMemo(
    () => createNavigationTheme(colors, isDark),
    [colors, isDark],
  );

  const openSurveyFromPush = useCallback(
    async (surveyUrl: string, messageId?: string, title?: string) => {
      if (!navigationReady.current || !navigationRef.current?.isReady()) {
        return;
      }

      const dedupeKey = messageId ?? surveyUrl;
      if (handledMessageIds.current.has(dedupeKey)) {
        return;
      }
      handledMessageIds.current.add(dedupeKey);

      navigationRef.current.navigate("Survey", {
        surveyUrl,
        messageId,
        title: title ?? "Survey invitation",
      });

      if (messageId) {
        try {
          await acknowledgeDelivery(messageId);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Delivery ack failed";
          Alert.alert("Delivery acknowledgement failed", message);
        }
      }
    },
    [],
  );

  function navigateToSurvey(surveyUrl: string, messageId?: string) {
    void openSurveyFromPush(surveyUrl, messageId);
  }

  // Path 1: Check NSUserDefaults for pending survey (handles killed/background → tap)
  function checkPendingSurvey() {
    if (Platform.OS !== "ios") return;

    // Read all values before clearing
    const surveyUrl = Settings.get("pendingSurveyUrl");
    const timestamp = Settings.get("pendingSurveyTimestamp") as number | null;
    const messageId = Settings.get("pendingMessageId") as string | null;

    // Always clear — no matter what, wipe stored values so they never fire again
    clearPendingSurveyDefaults();

    if (!surveyUrl || typeof surveyUrl !== "string" || surveyUrl.length === 0) return;

    // Only process if the entry is fresh (written within last N seconds)
    if (!timestamp) return;
    const ageSeconds = Date.now() / 1000 - timestamp;
    if (ageSeconds > PENDING_SURVEY_MAX_AGE_S) return;

    navigateToSurvey(surveyUrl, messageId ?? undefined);
  }

  useEffect(() => {
    async function setupPush(): Promise<void> {
      await configurePushNotifications();
      initializeFirebaseMessaging();
    }

    void setupPush().catch((error) => {
      console.warn("Push setup failed:", error);
    });
  }, []);

  useEffect(() => {
    setPushInvitationHandlers({
      onOpen: (invitation) => {
        void openSurveyFromPush(invitation.surveyUrl!, invitation.messageId, invitation.title);
      },
    });

    return () => {
      clearPushInvitationHandlers(["onOpen"]);
    };
  }, [openSurveyFromPush]);

  useEffect(() => {
    const responseSub = addNotificationResponseListener((response) => {
      const invitation = extractInvitationFromNotification(response.notification);
      if (invitation.surveyUrl) {
        void openSurveyFromPush(invitation.surveyUrl, invitation.messageId, invitation.title);
      }
    });

    return () => {
      responseSub.remove();
    };
  }, [openSurveyFromPush]);

  // Path 2: Listen for deep link URL events (handles foreground → tap)
  useEffect(() => {
    const subscription = Linking.addEventListener("url", (event) => {
      const data = parseSurveyDeepLink(event.url);
      if (data) {
        clearPendingSurveyDefaults();
        navigateToSurvey(data.surveyUrl, data.messageId);
      }
    });

    return () => subscription.remove();
  }, []);

  // Path 1 trigger: Check on AppState change (background → active)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setTimeout(checkPendingSurvey, 300);
      }
    });

    return () => subscription.remove();
  }, []);

  function onNavigationReady() {
    navigationReady.current = true;
    // Check immediately in case app was launched from a notification tap
    setTimeout(checkPendingSurvey, 300);
  }

  const openSurveyFromForegroundBanner = useCallback(
    (invitation: PushInvitation) => {
      if (!invitation.surveyUrl) {
        return;
      }
      void openSurveyFromPush(invitation.surveyUrl, invitation.messageId, invitation.title);
    },
    [openSurveyFromPush],
  );

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
        <AppNavigator initialRoute="Home" />
      </NavigationContainer>
      <ForegroundInvitationBanner onOpen={openSurveyFromForegroundBanner} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
