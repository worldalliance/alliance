import { describe, expect, it } from "bun:test";
import { getApiUrl } from "./config";

describe("getApiUrl", () => {
  it("appends /api to VITE_API_URL outside development", () => {
    expect(getApiUrl()).toBe(`${process.env.VITE_API_URL}/api`);
  });

  it("throws when VITE_API_URL is unset", () => {
    const saved = process.env.VITE_API_URL;
    delete process.env.VITE_API_URL;
    try {
      expect(() => getApiUrl()).toThrow("VITE_API_URL: missing");
    } finally {
      process.env.VITE_API_URL = saved;
    }
  });
});
