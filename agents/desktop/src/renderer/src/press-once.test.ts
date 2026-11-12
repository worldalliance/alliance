import { expect, test } from "bun:test";
import { pressOnce } from "./press-once";

const click = (detail: number, timeStamp: number) => ({
  detail,
  timeStamp,
  preventDefault: () => undefined,
});

test("presses on a click or keyboard activation, not a double-click's second click, whose default it cancels", () => {
  const pressed: number[] = [];
  const prevented: number[] = [];
  for (const [i, detail] of [0, 1, 2, 3].entries()) {
    pressOnce(() => undefined).onClick(click(1, i * 10_000));
    pressOnce(() => pressed.push(detail)).onClick({
      ...click(detail, i * 10_000 + 100),
      preventDefault: () => prevented.push(detail),
    });
  }
  expect(pressed).toEqual([0, 1]);
  expect(prevented).toEqual([2, 3]);
});

test("presses on a click the OS counts as a double-click's once 500 ms have passed since the last click", () => {
  const pressedAt: number[] = [];
  const button = (timeStamp: number) =>
    pressOnce(() => pressedAt.push(timeStamp)).onClick(click(2, timeStamp));
  pressOnce(() => undefined).onClick(click(1, 99_000));
  button(100_000);
  button(100_499);
  button(100_998);
  button(101_498);
  expect(pressedAt).toEqual([100_000, 101_498]);
});

test("ignores every later click of a triple-click", () => {
  const pressed: number[] = [];
  for (const [detail, timeStamp] of [
    [1, 200_000],
    [2, 200_250],
    [3, 200_500],
  ])
    pressOnce(() => pressed.push(detail)).onClick(click(detail, timeStamp));
  expect(pressed).toEqual([1]);
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
