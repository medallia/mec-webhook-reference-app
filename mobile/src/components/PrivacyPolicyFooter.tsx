import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getAppConfig } from "../types/config";

type Props = {
  fixed?: boolean;
};

export default function PrivacyPolicyFooter({ fixed = false }: Props) {
  return (
    <View style={[styles.footer, fixed && styles.footerFixed]}>
      <Pressable onPress={() => Linking.openURL(getAppConfig().privacyPolicyUrl)}>
        <Text style={styles.footerLink}>Privacy Policy</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: "auto",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#D9E2EC",
    alignItems: "center",
  },
  footerFixed: {
    marginTop: 0,
    paddingBottom: 16,
    backgroundColor: "#F7F9FC",
  },
  footerLink: {
    color: "#1F4FD8",
    fontSize: 13,
    fontWeight: "500",
  },
});
