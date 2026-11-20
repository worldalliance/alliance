import { afterEach, expect, it, mock, setSystemTime } from "bun:test";
import { minutesToMilliseconds } from "date-fns";
import {
  type OtaFetchFailure,
  OtaFetchStep,
  reportOtaFailuresHourly,
} from "./otaFailureReports";

afterEach(() => {
  setSystemTime();
});

const at = (minutes: number) =>
  setSystemTime(new Date(minutesToMilliseconds(minutes)));

it("reports each step's failure at most once an hour, on its own clock", () => {
  const report = mock((_failure: OtaFetchFailure) => {});
  const fail = reportOtaFailuresHourly(report);
  const failures: [number, OtaFetchStep][] = [
    [0, OtaFetchStep.Check],
    [5, OtaFetchStep.Check],
    [30, OtaFetchStep.Download],
    [45, OtaFetchStep.Download],
    [59, OtaFetchStep.Check],
    [61, OtaFetchStep.Check],
    [91, OtaFetchStep.Download],
  ];
  for (const [minutes, step] of failures) {
    at(minutes);
    fail({ step, cause: new Error(step) });
  }
  expect(report.mock.calls.map(([failure]) => failure.step)).toEqual([
    OtaFetchStep.Check,
    OtaFetchStep.Download,
    OtaFetchStep.Check,
    OtaFetchStep.Download,
  ]);
});
