import { expect, test } from "bun:test";
import {
  createActiveTimeCounter,
  KORA_IDLE_MS,
  KORA_REPORT_EVERY_SECONDS,
} from "./koraActiveTime";

const setup = () => {
  let now = 0;
  const reports: number[] = [];
  const counter = createActiveTimeCounter({
    report: (seconds) => reports.push(seconds),
    now: () => now,
  });
  const tick = (visible: boolean, times = 1) => {
    for (let i = 0; i < times; i++) {
      now += 1000;
      counter.tick(visible);
    }
  };
  return { counter, reports, tick, advance: (ms: number) => (now += ms) };
};

test("reports a batch once enough visible, recently used seconds pass", () => {
  const { counter, reports, tick } = setup();
  tick(true, KORA_REPORT_EVERY_SECONDS - 1);
  expect(reports).toEqual([]);
  counter.input();
  tick(true);
  expect(reports).toEqual([KORA_REPORT_EVERY_SECONDS]);
});

test("doesn't count hidden seconds", () => {
  const { counter, reports, tick } = setup();
  tick(false, 10);
  tick(true, 3);
  counter.flush();
  expect(reports).toEqual([3]);
});

test("stops counting once input is older than the idle limit", () => {
  const { counter, reports, tick, advance } = setup();
  advance(KORA_IDLE_MS);
  tick(true, 5);
  counter.input();
  tick(true, 2);
  counter.flush();
  expect(reports).toEqual([2]);
});

test("flushes nothing when nothing is unsent", () => {
  const { counter, reports } = setup();
  counter.flush();
  expect(reports).toEqual([]);
});
