import { ProfileDto } from "@alliance/shared/client";
import ActivityLikeButton from "./ActivityLikeButton";
import UserProfilePicRow from "./UserProfilePicRow";

interface ActivityLikesButtonRowProps {
  isLiked: boolean;
  handleLike: (() => void) | null;
  labelText?: boolean;
  likes?: ProfileDto[];
  likesCount?: number;
}
const ActivityLikesButtonRow = ({
  isLiked,
  likes,
  likesCount,
  handleLike,
  labelText = false,
}: ActivityLikesButtonRowProps) => {
  return (
    <div className="flex flex-row items-center justify-between w-full gap-x-2">
      <ActivityLikeButton
        liked={isLiked}
        likes={likesCount ?? likes?.length ?? 0}
        handleLike={handleLike}
        labelText={labelText}
      />
      {likes && <UserProfilePicRow users={likes} />}
    </div>
  );
};

export default ActivityLikesButtonRow;
