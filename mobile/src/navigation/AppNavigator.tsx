import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import RegisterScreen from "../screens/RegisterScreen";
import SurveyScreen from "../screens/SurveyScreen";
import { useAppTheme } from "../theme/ThemeContext";

export type RootStackParamList = {
  Home: undefined;
  Register: undefined;
  Survey: {
    surveyUrl: string;
    messageId?: string;
    title?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  initialRoute: keyof RootStackParamList;
}

export default function AppNavigator({ initialRoute }: AppNavigatorProps) {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Survey Invitations" }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: "Register Device",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Survey"
        component={SurveyScreen}
        options={{ title: "Survey" }}
      />
    </Stack.Navigator>
  );
}
