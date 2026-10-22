import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * AsyncStorage has no native module under bun, so a test that needs its items
 * keeps them in memory until `jest.restoreAllMocks`.
 */
export function memoryAsyncStorage(): void {
  const items = new Map<string, string>();
  jest
    .spyOn(AsyncStorage, "getItem")
    .mockImplementation(async (key) => items.get(key) ?? null);
  jest.spyOn(AsyncStorage, "setItem").mockImplementation(async (key, value) => {
    items.set(key, value);
  });
}
