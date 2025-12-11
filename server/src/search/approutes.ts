import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';

export function profileUrl(userId: number) {
  return `/member/${userId}`;
}

export function inviteUrl(referralCode: string) {
  return `/invite?ref=${referralCode}`;
}

export function actionUrl(actionId: number, full = false) {
  const path = `/actions/${actionId}`;
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function groupInvitesUrl() {
  return `/groups?tab=invites`;
}

export function actionActivityUrl(
  actionId: number,
  activityId: number,
  full = false,
) {
  const path = `/actions/${actionId}/activity/${activityId}`;
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function tasksUrl(full = false) {
  const path = `/tasks`;
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function postUrl(postId: number) {
  return `/forum/post/${postId}`;
}

export function commentUrl(
  comment: Pick<Comment, 'parentObjectType' | 'parentObjectId' | 'id'>,
  actionId?: number,
) {
  switch (comment.parentObjectType) {
    case CommentParentObject.Post:
      return `/forum/post/${comment.parentObjectId}?replyId=${comment.id}`;
    case CommentParentObject.Action:
      return `/actions/${comment.parentObjectId}?replyId=${comment.id}`;
    case CommentParentObject.Activity:
      return `/actions/${actionId}/activity/${comment.parentObjectId}?replyId=${comment.id}`;
    default:
      throw new Error(
        `Invalid parent object type: ${comment.parentObjectType satisfies never}`,
      );
  }
}

export function withCid(url: string, cid: string) {
  return url.includes('?') ? `${url}&cid=${cid}` : `${url}?cid=${cid}`;
}

export function withSid(url: string, sid: string) {
  return url.includes('?') ? `${url}&sid=${sid}` : `${url}?sid=${sid}`;
}
