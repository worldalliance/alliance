import { Comment } from "./entities/comment.entity";
import { Post } from "./entities/post.entity";

type ForumListEntry = {
  post: Pick<Post, "pinned" | "updatedAt">;
  lastComment?: Pick<Comment, "createdAt">;
};

const lastActivity = ({ post, lastComment }: ForumListEntry) =>
  (lastComment?.createdAt ?? post.updatedAt).getTime();

export const byForumListOrder = (a: ForumListEntry, b: ForumListEntry) =>
  Number(b.post.pinned) - Number(a.post.pinned) ||
  lastActivity(b) - lastActivity(a);
