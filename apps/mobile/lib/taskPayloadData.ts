import { R, type Result } from "@alliance/common/result";
import type { NotificationTaskPayload } from "expo-notifications";

/** The push's data, from the payload a background notification task gets. */
export function taskPayloadData(
  payload: NotificationTaskPayload,
): Result<unknown, Error> {
  // A badge push is never shown, so it never arrives as a tapped response.
  if ("actionIdentifier" in payload) {
    return R.success(null);
  }
  const { dataString } = payload.data;
  if (!dataString) {
    return R.success(null);
  }
  return R.fromThrowable((): unknown => JSON.parse(dataString));
}
