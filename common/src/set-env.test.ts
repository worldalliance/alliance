import { afterEach, expect, test } from "bun:test";
import { setEnv } from "./set-env";

const KEY = "ALLIANCE_SET_ENV_TEST";

afterEach(() => {
  delete process.env[KEY];
});

test("sets a value", () => {
  setEnv(KEY, "on");
  expect(process.env[KEY]).toBe("on");
});

test("removes the key for undefined", () => {
  process.env[KEY] = "on";
  setEnv(KEY, undefined);
  expect(KEY in process.env).toBe(false);
});
