import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import PrivacyPolicyFooter from "../components/PrivacyPolicyFooter";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useAppTheme } from "../theme/ThemeContext";

type Props = NativeStackScreenProps<RootStackParamList, "Survey">;

export default function SurveyScreen({ route }: Props) {
  const { surveyUrl } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        webview: {
          flex: 1,
        },
      }),
    [colors],
  );

  return (
    <View style={styles.container}>
      <WebView source={{ uri: surveyUrl }} startInLoadingState style={styles.webview} />
      <PrivacyPolicyFooter fixed />
    </View>
  );
}

