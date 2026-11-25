import { describe, expect, it } from "bun:test";
import { webRuntimeConfig } from "./runtimeConfig";
import { setTestWebRuntimeConfig } from "./testing/runtimeConfig";

describe("webRuntimeConfig", () => {
  it("returns the config the app loaded", () => {
    setTestWebRuntimeConfig({ VITE_ALT_APP_URL: "https://alt.test" });
    expect(webRuntimeConfig().VITE_ALT_APP_URL).toBe("https://alt.test");
  });

  it("throws when read before the app loads one", async () => {
    const fresh = await import(`./runtimeConfig?fresh=${Date.now()}`);
    expect(() => fresh.webRuntimeConfig()).toThrow(
      "The web runtime config was read before the app loaded it",
    );
  });
});
