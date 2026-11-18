import { ExceptionEvent } from "@alliance/common/analytics";
import { R, type Result } from "@alliance/common/result";
import { captureException } from "@alliance/shared/lib/analytics";
import * as Updates from "expo-updates";

export const OTA_UPDATES_ENABLED = Updates.isEnabled && !__DEV__;

enum OtaFetchStep {
  Check = "check",
  Download = "download",
}

type OtaFetchFailure = { step: OtaFetchStep; cause: unknown };

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

/**
 * Downloads a published update, if any, reporting a failure; `true` when a new
 * update was downloaded.
 */
export async function fetchAvailableUpdate(): Promise<
  Result<boolean, OtaFetchFailure>
> {
  if (!OTA_UPDATES_ENABLED) return R.success(false);
  const fetched = await checkAndDownload();
  if (R.isFailure(fetched)) {
    captureException(
      ExceptionEvent.OtaForegroundUpdateFailed,
      fetched.error.cause,
      { step: fetched.error.step },
    );
  }
  return fetched;
}
