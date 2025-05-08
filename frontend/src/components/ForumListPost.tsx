import { formatDistanceToNow } from "date-fns";
import Card, { CardStyle } from "./system/Card";
import { PostDto } from "../client";
import Badge from "./system/Badge";

const ForumListPost = ({
  post,
  handleViewPost,
}: {
  post: PostDto;
  handleViewPost: (id: number) => void;
}) => {
  return (
    <Card
      key={post.id}
      className="w-full rounded-none -mb-[1px] hover:z-10"
      onClick={() => handleViewPost(post.id)}
      style={CardStyle.White}
    >
      <div className="flex flex-row justify-between gap-3">
        <p className="text-md font-medium">{post.title}</p>
        <Badge>{post.action?.category}</Badge>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <div>
          {post.author?.name || "Unknown user"}
          {post.action?.name && (
            <span className="text-blue-600 ml-1">• {post.action.name}</span>
          )}
        </div>
        <div className="flex space-x-3">
          <span>{post.replies?.length || 0} replies</span>
          <span>
            {formatDistanceToNow(new Date(post.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default ForumListPost;
