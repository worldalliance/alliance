import { formatDistanceToNow } from "date-fns";
import Card, { CardStyle } from "./system/Card";
import { PostDto } from "@alliance/shared/client";
import Badge from "./system/Badge";
import { useNavigate } from "react-router";

export interface ForumListPostProps {
  post: PostDto;
  handleViewPost: (id: number) => void;
}

const ForumListPost = ({ post, handleViewPost }: ForumListPostProps) => {
  const navigate = useNavigate();

  const authorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/user/${post.author?.id}`);
  };

  return (
    <Card
      key={post.id}
      className={`w-full mb-0 my-[4px] rounded-sm`}
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
            <a
              href={`/action/${post.action.id}`}
              className="text-blue ml-1 hover:underline"
            >
              {post.action.name}
            </a>
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
