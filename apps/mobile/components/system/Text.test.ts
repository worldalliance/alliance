import { afterEach, expect, it } from "bun:test";
import { Platform } from "react-native";
import { FontFamily, FontWeight, resolveFontFamily } from "./Text";

const platform = Platform.OS;
afterEach(() => {
  Platform.OS = platform;
});

it("quotes a multi-word family on web, where CSS drops it unquoted", () => {
  Platform.OS = "web";
  expect(
    resolveFontFamily(FontFamily.Sans, FontWeight.Semibold).fontFamily,
  ).toMatch(/^".+ .+"$/);
});

it("leaves family names unquoted on native", () => {
  Platform.OS = "ios";
  expect(
    resolveFontFamily(FontFamily.Sans, FontWeight.Semibold).fontFamily,
  ).not.toContain('"');
});
