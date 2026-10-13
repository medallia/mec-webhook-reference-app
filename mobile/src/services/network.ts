import NetInfo from "@react-native-community/netinfo";

export const OFFLINE_MESSAGE =
  "You appear to be offline. Check your connection and try again.";

export async function ensureOnline(): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false || state.isInternetReachable === false) {
    throw new Error(OFFLINE_MESSAGE);
  }
}
