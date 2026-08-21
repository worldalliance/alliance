import {
  actionActivityIsVisibleInFeed,
  FeedActionActivity,
} from "@alliance/common/actionActivity";
import { ActionActivityDto } from "@alliance/shared/client";

export type FeedActionActivityDto = ActionActivityDto & {
  type: FeedActionActivity;
};

export function actionActivityDtoIsVisibleInFeed(
  activity: ActionActivityDto,
): activity is FeedActionActivityDto {
  const t = activity.type;
  const visible = actionActivityIsVisibleInFeed(t);
  if (!visible) return false;
  t satisfies FeedActionActivity;
  return visible;
}
