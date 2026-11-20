import { mock } from "bun:test";

// Metro defines this and bun doesn't. It runs as a preload, rather than per
// test file, because `bun test` shares one `globalThis` across the run: a file
// that set it would leak it into every file after it and no others.
Object.assign(globalThis, { __DEV__: true });

// Component tests render through react-dom, so the react-native stand-ins
// below render their children and drop the rest.
const Passthrough = ({ children }: { children?: React.ReactNode }) =>
  children ?? null;

// Bun can't parse react-native's Flow sources or reach the native modules. The
// rule's concern is a mock leaking from one file into later ones; a preload's
// mock reaches every file alike.
/* eslint-disable no-restricted-properties */
mock.module("react-native", () => ({
  NativeModules: {},
  Platform: {
    OS: "ios",
    select: <T>(options: { ios?: T; default?: T }) =>
      options.ios ?? options.default,
  },
  View: Passthrough,
  Text: Passthrough,
  TouchableOpacity: Passthrough,
  ActivityIndicator: () => null,
  AccessibilityInfo: { announceForAccessibility: () => {} },
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: () => {} }),
  },
  Linking: { openURL: async () => {} },
}));
mock.module("expo-router", () => ({
  useIsFocused: () => true,
  useUnstableGlobalHref: () => "/",
}));
mock.module("expo-updates", () => ({
  useUpdates: () => ({ isUpdatePending: false }),
}));
mock.module("expo-application", () => ({
  applicationId: "com.alliance.alliancemobile",
}));
const secureStore = new Map<string, string>();
mock.module("expo-secure-store", () => ({
  getItemAsync: async (key: string) => secureStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) =>
    void secureStore.set(key, value),
  deleteItemAsync: async (key: string) => void secureStore.delete(key),
}));
/* eslint-enable no-restricted-properties */
