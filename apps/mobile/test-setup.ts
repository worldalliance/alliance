import { clearSecureStore } from "./test-stubs/expo-secure-store";

// Metro defines this and bun doesn't. It runs as a preload, rather than per
// test file, because `bun test` shares one `globalThis` across the run: a file
// that set it would leak it into every file after it and no others.
Object.assign(globalThis, { __DEV__: true });

// expo-device and expo-secure-store pull in react-native through
// expo-modules-core, and bun can't parse react-native's Flow types, so a test
// that reaches either can't load it. Each is answered by the file of the same
// name under test-stubs.
const stub = (name: string) => ({
  contents: `export * from "${Bun.fileURLToPath(new URL(`./test-stubs/${name}.ts`, import.meta.url))}";`,
  loader: "js" as const,
});

Bun.plugin({
  name: "expo-native-module-stubs",
  setup(build) {
    build.onLoad({ filter: /node_modules\/expo-device\// }, () =>
      stub("expo-device"),
    );
    build.onLoad({ filter: /node_modules\/expo-secure-store\// }, () =>
      stub("expo-secure-store"),
    );
  },
});

// The stub's store outlives each test file, so it is cleared here rather than
// per file. A `beforeAll` seed is gone before the file's first test, so seed
// in `beforeEach` or in the test itself.
beforeEach(() => clearSecureStore());
