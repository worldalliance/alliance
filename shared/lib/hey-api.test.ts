import { createClientConfig } from "./hey-api";

const originalNavigator = globalThis.navigator;

const runningAs = (product: string): void => {
  Object.defineProperty(globalThis, "navigator", {
    value: { product },
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
  });
});

describe("createClientConfig", () => {
  it("omits cookies in the app", () => {
    runningAs("ReactNative");

    expect(createClientConfig().credentials).toBe("omit");
  });

  it("sends them in a browser", () => {
    runningAs("Gecko");

    expect(createClientConfig().credentials).toBe("include");
  });
});
