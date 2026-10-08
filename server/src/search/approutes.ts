import { appendQueryParam } from "@alliance/common/url";
import {
  waitlistShareUrl,
  waitlistUnsubscribeUrl,
} from "@alliance/common/waitlist";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";

export function profileUrl(userId: number) {
  return `/member/${userId}`;
}

export function actionUrl(actionId: number, full = false) {
  const path = `/actions/${actionId}`;
  return full ? `${siteBaseUrl()}${path}` : path;
}

function waitlistBaseUrl() {
  const baseUrl = siteBaseUrl();
  if (!baseUrl) {
    throw new Error("APP_URL is not set, so a waitlist link has no host");
  }
  return baseUrl;
}

export function waitlistShareLink(code: string) {
  return waitlistShareUrl(waitlistBaseUrl(), code);
}

export function waitlistUnsubscribeLink(token: string) {
  return waitlistUnsubscribeUrl(waitlistBaseUrl(), token);
}

export function signupUrl(full = false) {
  const path = `/signup`;
  return full ? `${siteBaseUrl()}${path}` : path;
}

export function siteBaseUrl() {
  return process.env.ALT_APP_URL || process.env.APP_URL;
}

export function groupUrl(params?: {
  tab?: "invites" | "groups" | "members";
  communityId?: number;
}) {
  return `/groups?${new URLSearchParams({
    ...(params?.tab !== undefined && { tab: params.tab }),
    ...(params?.communityId !== undefined && {
      communityId: params.communityId.toString(),
    }),
  }).toString()}`;
}

export function actionActivityUrl(
  actionId: number,
  activityId: number,
  full = false,
) {
  const path = `/actions/${actionId}/activity/${activityId}`;
  return full ? `${siteBaseUrl()}${path}` : path;
}

export function tasksUrl(full = false) {
  const path = `/tasks`;
  return full ? `${siteBaseUrl()}${path}` : path;
}

export function groupMembersListUrl(full = false) {
  const path = `/groups?tab=members`; //TODO: multiple groups
  return full ? `${siteBaseUrl()}${path}` : path;
}

export function postUrl(postId: number) {
  return `/forum/post/${postId}`;
}

export function commentUrl(
  comment: Pick<Comment, "parentObjectType" | "parentObjectId" | "id">,
  actionId?: number,
  full = false,
) {
  let path = "";
  switch (comment.parentObjectType) {
    case CommentParentObject.Post:
      path = `/forum/post/${comment.parentObjectId}?replyId=${comment.id}`;
      break;
    case CommentParentObject.Action:
      path = `/actions/${comment.parentObjectId}?replyId=${comment.id}`;
      break;
    case CommentParentObject.Activity:
      path = `/actions/${actionId}/activity/${comment.parentObjectId}?replyId=${comment.id}`;
      break;
    default:
      throw new Error(
        `Invalid parent object type: ${comment.parentObjectType satisfies never}`,
      );
  }
  return full ? `${siteBaseUrl()}${path}` : path;
}

export function conversationUrl(conversationId: number) {
  return `/messages/${conversationId}`;
}

export function withSid(url: string, sid: string) {
  return appendQueryParam(url, "sid", sid);
}

export function withRef(url: string, ref: string) {
  return appendQueryParam(url, "ref", ref);
}
