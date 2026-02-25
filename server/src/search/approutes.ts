import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';

export function profileUrl(userId: number) {
  return `/member/${userId}`;
}

export function actionUrl(actionId: number, full = false) {
  const path = `/actions/${actionId}`;
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function groupUrl(params?: {
  tab?: 'invites' | 'groups' | 'members';
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
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function tasksUrl(full = false) {
  const path = `/tasks`;
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function groupMembersListUrl(full = false) {
  const path = `/groups?tab=members`; //TODO: multiple groups
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function postUrl(postId: number) {
  return `/forum/post/${postId}`;
}

export function commentUrl(
  comment: Pick<Comment, 'parentObjectType' | 'parentObjectId' | 'id'>,
  actionId?: number,
  full = false,
) {
  let path = '';
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
  return full ? `${process.env.APP_URL}${path}` : path;
}

export function withCid(url: string, cid: string) {
  return url.includes('?') ? `${url}&cid=${cid}` : `${url}?cid=${cid}`;
}

export function withSid(url: string, sid: string) {
  return url.includes('?') ? `${url}&sid=${sid}` : `${url}?sid=${sid}`;
}
