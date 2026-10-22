import type { PostDto } from "../client";
import { formatFullDateTime } from "./dateFormatters";
import { formatTime } from "./utils";

export function isScheduledPost<P extends Pick<PostDto, "visibleAt">>(
  post: P,
  now = new Date(),
): post is P & { visibleAt: string } {
  return post.visibleAt !== null && new Date(post.visibleAt) > now;
}

export const scheduledPostNotice = {
  list: (visibleAt: string) =>
    `Not visible to members yet - will be posted ${formatTime(new Date(visibleAt), { addSuffix: true })}`,
  detail: (visibleAt: string) =>
    `Not visible to members yet. This post is scheduled for ${formatFullDateTime(new Date(visibleAt))}.`,
};
