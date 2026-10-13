import AsyncStorage from "@react-native-async-storage/async-storage";

const CONTACT_ID_KEY = "contact_id";
const PUSH_SERVER_OPT_IN_KEY = "push_server_opt_in";
const LAST_INVITATION_KEY = "last_invitation"; // legacy key cleared on reset

export async function saveContactId(contactId: string): Promise<void> {
  await AsyncStorage.setItem(CONTACT_ID_KEY, contactId);
}

export async function getContactId(): Promise<string | null> {
  return AsyncStorage.getItem(CONTACT_ID_KEY);
}

export async function clearContactId(): Promise<void> {
  await AsyncStorage.removeItem(CONTACT_ID_KEY);
}

export async function getPushServerOptIn(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PUSH_SERVER_OPT_IN_KEY);
  return value === "true";
}

export async function setPushServerOptIn(optIn: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_SERVER_OPT_IN_KEY, optIn ? "true" : "false");
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([CONTACT_ID_KEY, PUSH_SERVER_OPT_IN_KEY, LAST_INVITATION_KEY]);
}
