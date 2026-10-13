import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";

interface MedalliaLogoProps {
  size?: number;
}

const iconSources = {
  light: require("../../assets/icon.png"),
  dark: require("../../assets/icon-dark.png"),
};

export default function MedalliaLogo({ size = 80 }: MedalliaLogoProps) {
  const { isDark } = useAppTheme();
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        // Wait 5 seconds
        Animated.delay(5000),
        // Flip forward (0 -> 1)
        Animated.timing(flipAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Wait 5 seconds
        Animated.delay(5000),
        // Flip back (1 -> 0)
        Animated.timing(flipAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [flipAnim]);

  const rotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY }] }}>
        <Image
          source={isDark ? iconSources.dark : iconSources.light}
          style={{ width: size, height: size, borderRadius: size * 0.15 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 16,
  },
});
