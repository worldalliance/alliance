import { ExceptionEvent } from "@alliance/common/analytics";
import { R, type Result } from "@alliance/common/result";
import { captureException } from "@alliance/shared/lib/analytics";
import * as Updates from "expo-updates";
import {
  type OtaFetchFailure,
  OtaFetchStep,
  reportOtaFailuresHourly,
} from "./otaFailureReports";
import { shareInFlight } from "./shareInFlight";

export const OTA_UPDATES_ENABLED = Updates.isEnabled && !__DEV__;

async function checkAndDownload(): Promise<Result<boolean, OtaFetchFailure>> {
  const checked = await R.fromPromise(Updates.checkForUpdateAsync());
  if (R.isFailure(checked)) {
    return R.failure({ step: OtaFetchStep.Check, cause: checked.error });
  }
  if (!checked.value.isAvailable) return R.success(false);
  const fetched = await R.fromPromise(Updates.fetchUpdateAsync());
  return R.isFailure(fetched)
    ? R.failure({ step: OtaFetchStep.Download, cause: fetched.error })
    : R.success(fetched.value.isNew);
}

const reportFetchFailure = reportOtaFailuresHourly((failure) =>
  captureException(ExceptionEvent.OtaForegroundUpdateFailed, failure.cause, {
    step: failure.step,
  }),
);

/**
 * Downloads a published update, if any, reporting a failed check or download
 * at most once an hour each; `true` when a new update was downloaded.
 */
async function fetchAvailableUpdate(): Promise<
  Result<boolean, OtaFetchFailure>
> {
  if (!OTA_UPDATES_ENABLED) return R.success(false);
  const fetched = await checkAndDownload();
  if (R.isFailure(fetched)) reportFetchFailure(fetched.error);
  return fetched;
}

/** `fetchAvailableUpdate`, joining a download already under way. */
export const downloadUpdateNow = shareInFlight(fetchAvailableUpdate);
