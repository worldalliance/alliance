import { ProfileDto } from "@alliance/shared/client";
import { getLikeSummaryParts } from "@alliance/shared/lib/likeSummary";
import { LikeTargetType } from "@alliance/shared/lib/useLikers";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import LikesModal from "./LikesModal";

export interface LikeSummaryProps {
  likeTargetType: LikeTargetType;
  likeTargetId: number;
  liked: boolean;
  likesCount: number;
  likers?: ProfileDto[];
  className?: string;
}

const LikeSummary = ({
  likeTargetType,
  likeTargetId,
  liked,
  likesCount,
  likers = [],
  className,
}: LikeSummaryProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (likesCount <= 0) return null;

  const { facepile, label } = getLikeSummaryParts({
    likers,
    currentUserId: user?.id,
    liked,
    likesCount,
  });

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "flex items-center gap-1.5 text-sm text-zinc-500 hover:underline",
          className,
        )}
      >
        <span className="flex items-center -space-x-2">
          {liked && (
            <span className="rounded ring-2 ring-white">
              <AvatarProfile pfp={user?.profilePicture ?? null} size="small" />
            </span>
          )}
          {facepile.map((u) => (
            <span key={u.id} className="rounded ring-2 ring-white">
              <AvatarProfile pfp={u.profilePicture} size="small" />
            </span>
          ))}
        </span>
        <span>{label}</span>
      </button>
      <LikesModal
        open={open}
        onClose={() => setOpen(false)}
        targetType={likeTargetType}
        targetId={likeTargetId}
        likesCount={likesCount}
      />
    </>
  );
};

export default LikeSummary;
