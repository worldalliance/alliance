import { afterEach, describe, expect, test } from "bun:test";
import { getSiteUrl } from "./config";

declare global {
  interface Window {
    happyDOM: { setURL: (url: string) => void };
  }
}

describe("getSiteUrl", () => {
  afterEach(() => window.happyDOM.setURL("http://localhost:3000/"));

  test.each([
    "https://thealliance.org",
    "https://worldalliance.org",
    "https://staging.thealliance.org",
  ])("follows the domain the page was loaded on: %s", (origin) => {
    window.happyDOM.setURL(`${origin}/actions/1`);

    expect(getSiteUrl()).toBe(origin);
  });
});
