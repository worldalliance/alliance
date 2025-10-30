import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';

export function profileUrl(userId: number) {
  return `/user/${userId}`;
}

export function inviteUrl(referralCode: string) {
  return `/invite?ref=${referralCode}`;
}

export function actionUrl(actionId: number, full = false) {
  const path = `/actions/${actionId}`;
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
  if (comment.parentObjectType === CommentParentObject.Post) {
    return `/forum/post/${comment.parentObjectId}?replyId=${comment.id}`;
  } else if (comment.parentObjectType === CommentParentObject.Action) {
    return `/actions/${comment.parentObjectId}?replyId=${comment.id}`;
  } else if (comment.parentObjectType === CommentParentObject.Activity) {
    return `/actions/${actionId}/activity/${comment.parentObjectId}?replyId=${comment.id}`;
  }
}

export function withCid(url: string, cid: string) {
  return url.includes('?') ? `${url}&cid=${cid}` : `${url}?cid=${cid}`;
}
