// React Native provides setImmediate; react-native-web does not.
if (typeof globalThis.setImmediate === "undefined") {
  Object.assign(globalThis, {
    setImmediate: (callback: () => void) => setTimeout(callback, 0),
    clearImmediate: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  });
}
