import { formatDistanceToNow } from "date-fns";
import Card, { CardStyle } from "./system/Card";
import { PostDto } from "@alliance/shared/client";
import Badge from "./system/Badge";
import { useNavigate } from "react-router-dom";

export interface ForumListPostProps {
  post: PostDto;
  handleViewPost: (id: number) => void;
  first?: boolean;
  last?: boolean;
}

const ForumListPost = ({
  post,
  handleViewPost,
  first,
  last,
}: ForumListPostProps) => {
  const navigate = useNavigate();

  const authorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/user/${post.author?.id}`);
  };

  return (
    <Card
      key={post.id}
      className={`rounded-none w-full mb-0 hover:z-20 ${first ? "rounded-t-lg" : ""} ${last ? "rounded-b-lg" : ""}`}
      onClick={() => handleViewPost(post.id)}
      style={CardStyle.White}
    >
      <div className="flex flex-row justify-between gap-3">
        <p className="text-md font-medium">{post.title}</p>
        {post.action?.category && <Badge>{post.action.category}</Badge>}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <div className="flex flex-row gap-x-2">
          <p onClick={authorClick} className="hover:underline">
            {post.author?.name || "Unknown user"}
          </p>
          {post.action?.name && (
            <span className="text-blue-600 ml-1">{post.action.name}</span>
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
