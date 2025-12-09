import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

export interface BaseLikeButtonProps {
  liked: boolean;
  likes: number;
  handleLike: (() => void) | null;
  className?: string;
  labelText?: boolean;
  size?: "small" | "medium" | "large";
  border?: boolean;
  backgroundColor?: string;
}

const BaseLikeButton = ({
  liked,
  likes,
  handleLike,
  className,
  labelText = false,
  size = "medium",
  border = false,
  backgroundColor = "transparent",
}: BaseLikeButtonProps) => {
  const [scaled, setScaled] = useState(false);
  useEffect(() => {
    if (liked) {
      setScaled(true);
      setTimeout(() => {
        setScaled(false);
      }, 200);
    }
  }, [liked]);

  const sizeClass = {
    small: 16,
    medium: 19,
    large: 20,
  };

  return (
    <div
      className={`flex flex-row gap-x-1 items-center bg-${backgroundColor} ${
        border
          ? "border border-zinc-300 rounded hover:bg-zinc-100 px-2 py-1.5"
          : ""
      } cursor-pointer transition-colors duration-100`}
      onClick={(e) => {
        if (handleLike) {
          e.stopPropagation();
          handleLike();
        }
      }}
    >
      <Heart
        size={sizeClass[size]}
        fill={liked ? "#ff3e24" : "none"}
        color={liked ? "#ff3e24" : "#222"}
        className={className}
        strokeWidth={1}
        style={{
          transform: scaled ? "scale(1.1)" : "scale(1)",
          transition: "transform 0.1s ease-in-out",
        }}
      />
      {likes > 0 && <p className="text-sm text-zinc-800">{likes}</p>}
      {labelText && likes > 0 && (
        <p className="text-sm text-zinc-800">
          {likes === 1 ? "Like" : "Likes"}
        </p>
      )}
    </div>
  );
};

export default BaseLikeButton;
