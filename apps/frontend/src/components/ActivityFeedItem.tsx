import { ProfileDto } from "@alliance/shared/client";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { Link } from "react-router";
import UserDisplayName from "./UserDisplayName";

export interface ActivityFeedItem {
  title: string;
  content: string;
  user: ProfileDto;
  titleLink?: string;
  showTitle?: boolean;
}

const ActivityFeedItem = ({
  title,
  content,
  user,
  titleLink,
  showTitle = true,
}: ActivityFeedItem) => {
  return (
    <div className="flex flex-row gap-x-2">
      <div className="flex-shrink-0 mt-1">
        <Link to={`/user/${user.id}`}>
          <ProfileImage pfp={user.profilePicture} size="small" />
        </Link>
      </div>
      <div className="">
        {showTitle && (
          <>
            {titleLink ? (
              <Link to={titleLink} className="text-green hover:underline">
                {title}
              </Link>
            ) : (
              <p className="text-green">{title}</p>
            )}
          </>
        )}
        <p className="text-sm lg:text-base text-zinc-900">
          <Link to={`/user/${user.id}`} onClick={(e) => e.stopPropagation()}>
            <UserDisplayName staff={user.staff}>
              {user.displayName}
            </UserDisplayName>
          </Link>{" "}
          {content}
        </p>
      </div>
    </div>
  );
};

export default ActivityFeedItem;
