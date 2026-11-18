import { ExceptionEvent } from "@alliance/common/analytics";
import { R } from "@alliance/common/result";
import { captureException } from "@alliance/shared/lib/analytics";
import * as Updates from "expo-updates";
import { SPLASH_RELOAD_SCREEN } from "../constants/splash";
import { reloadResumingAt } from "./resumeRoute";

/** Restarts into the downloaded update, reopening `route`; resolves false if it couldn't. */
export async function restartIntoUpdate(route: string): Promise<boolean> {
  const result = await reloadResumingAt({
    route,
    reload: () =>
      Updates.reloadAsync({ reloadScreenOptions: SPLASH_RELOAD_SCREEN }),
    report: ({ step, error }) =>
      captureException(ExceptionEvent.ResumeRouteFailed, error, { step }),
  });
  if (R.isSuccess(result)) return true;
  captureException(ExceptionEvent.OtaRestartFailed, result.error);
  return false;
}
