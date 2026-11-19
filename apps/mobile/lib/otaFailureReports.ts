import { milliseconds } from "date-fns";
import { throttle } from "es-toolkit";

export enum OtaFetchStep {
  Check = "check",
  Download = "download",
}

export type OtaFetchFailure = { step: OtaFetchStep; cause: unknown };

const OTA_FAILURE_REPORT_INTERVAL_MS = milliseconds({ hours: 1 });

/**
 * `report`, at most once per `OTA_FAILURE_REPORT_INTERVAL_MS` for each step.
 * Offline every check fails, and checks can come minutes apart; each step has
 * its own clock, so an offline check doesn't hide a failed download.
 */
export function reportOtaFailuresHourly(
  report: (failure: OtaFetchFailure) => void,
): (failure: OtaFetchFailure) => void {
  const throttled = () =>
    throttle(report, OTA_FAILURE_REPORT_INTERVAL_MS, { edges: ["leading"] });
  const byStep: Record<OtaFetchStep, (failure: OtaFetchFailure) => void> = {
    [OtaFetchStep.Check]: throttled(),
    [OtaFetchStep.Download]: throttled(),
  };
  return (failure) => byStep[failure.step](failure);
}
