import * as SplashScreen from "expo-splash-screen";

/**
 * A rejection means the splash was already hidden, which is the state we were
 * asking for, so every caller swallows it.
 */
export const hideSplash = (): void =>
  void SplashScreen.hideAsync().catch(() => {});
