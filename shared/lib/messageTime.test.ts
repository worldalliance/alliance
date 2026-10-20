import { afterEach, expect, setSystemTime, test } from "bun:test";
import { formatMessageTime } from "./messageTime";

const NOW = new Date("2026-10-20T12:00:00.000Z");
const secondsAgo = (seconds: number) =>
  new Date(NOW.getTime() - seconds * 1000);

afterEach(() => {
  setSystemTime();
});

test("shows a message from the last few seconds as now", () => {
  setSystemTime(NOW);
  expect(formatMessageTime(secondsAgo(0))).toBe("now");
  expect(formatMessageTime(secondsAgo(20))).toBe("now");
});

test("shows an older message as a relative time", () => {
  setSystemTime(NOW);
  expect(formatMessageTime(secondsAgo(90))).toBe("2 minutes ago");
  expect(formatMessageTime(secondsAgo(60 * 60))).toBe("1 hour ago");
});
