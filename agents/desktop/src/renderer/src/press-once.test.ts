import { expect, test } from "bun:test";
import { pressOnce } from "./press-once";

test("presses on a click or keyboard activation, not a double-click's second click", () => {
  const pressed = [0, 1, 2, 3].filter((detail) => {
    let hit = false;
    pressOnce(() => {
      hit = true;
    }).onClick({ detail });
    return hit;
  });
  expect(pressed).toEqual([0, 1]);
});

test("cancels only a held Enter's repeats", () => {
  const cancelled = (key: string, repeat: boolean) => {
    let prevented = false;
    pressOnce(() => undefined).onKeyDown({
      key,
      repeat,
      preventDefault: () => {
        prevented = true;
      },
    });
    return prevented;
  };
  expect(cancelled("Enter", true)).toBe(true);
  expect(cancelled("Enter", false)).toBe(false);
  expect(cancelled("Tab", true)).toBe(false);
  expect(cancelled(" ", true)).toBe(false);
});
