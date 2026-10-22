import { mock } from "bun:test";

// Metro defines this and bun doesn't. It runs as a preload, rather than per
// test file, because `bun test` shares one `globalThis` across the run: a file
// that set it would leak it into every file after it and no others.
Object.assign(globalThis, { __DEV__: true });

// Bun can't parse react-native's Flow sources or reach the native modules. The
// rule's concern is a mock leaking from one file into later ones; a preload's
// mock reaches every file alike.
/* eslint-disable no-restricted-properties */
mock.module("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios" },
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
