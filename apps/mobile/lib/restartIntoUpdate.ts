import { ExceptionEvent } from "@alliance/common/analytics";
import { R } from "@alliance/common/result";
import { captureException } from "@alliance/shared/lib/analytics";
import * as Updates from "expo-updates";
import { SPLASH_RELOAD_SCREEN } from "../constants/splash";

/** Restarts into the downloaded update; resolves false if it couldn't. */
export async function restartIntoUpdate(): Promise<boolean> {
  const result = await R.fromPromise(
    Updates.reloadAsync({ reloadScreenOptions: SPLASH_RELOAD_SCREEN }),
  );
  if (R.isSuccess(result)) return true;
  captureException(ExceptionEvent.OtaRestartFailed, result.error);
  return false;
}
