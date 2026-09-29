import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getSiteUrl } from "./config";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

describe("getSiteUrl", () => {
  const priorAlt = process.env.VITE_ALT_APP_URL;
  beforeEach(() => {
    process.env.VITE_ALT_APP_URL = "https://staging.thealliance.org";
  });
  afterEach(() => {
    process.env.VITE_ALT_APP_URL = priorAlt;
    window.happyDOM.setURL("http://localhost:3000/");
  });

  test("gives the alt site on the alt domain's admin", () => {
    window.happyDOM.setURL("https://admin.staging.thealliance.org/actions");

    expect(getSiteUrl()).toBe("https://staging.thealliance.org");
  });

  test("gives the build-time site on the legacy domain's admin", () => {
    window.happyDOM.setURL("https://admin.staging.worldalliance.org/actions");

    expect(getSiteUrl()).not.toBe("https://staging.thealliance.org");
    expect(getSiteUrl()).toBe(getBaseUrl());
  });
});
