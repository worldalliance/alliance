import { parseTaskBadgePush } from "@alliance/common/taskBadge";
import type { NotificationTaskPayload } from "expo-notifications";
import { taskPayloadData } from "./taskPayloadData";

/**
 * Applies a badge push the background task received. An app in the
 * foreground refetches instead, since the pushed count may predate its own.
 * A signed-out app leaves the icon at zero, since an unlink still pending
 * lets the last account's pushes through.
 */
export async function applyTaskBadgePush(params: {
  payload: NotificationTaskPayload;
  appActive: boolean;
  signedIn: () => Promise<boolean>;
  setBadge: (count: number) => Promise<void>;
  refetch: () => void;
}): Promise<void> {
  const data = taskPayloadData(params.payload);
  if (!data.ok) {
    console.error("unparseable push data in a background task", data.error);
    return;
  }
  const count = parseTaskBadgePush(data.value);
  if (!count.ok) {
    return;
  }
  if (params.appActive) {
    params.refetch();
    return;
  }
  if (await params.signedIn()) {
    await params.setBadge(count.value);
  }
}
