import { ProfileDto } from "@alliance/shared/client";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { Link, href } from "react-router";
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
        <Link to={href("/member/:id", { id: user.id.toString() })}>
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
          <Link
            to={href("/member/:id", { id: user.id.toString() })}
            onClick={(e) => e.stopPropagation()}
          >
            {user.displayName}
          </Link>{" "}
          {content}
        </p>
      </div>
    </div>
  );
};

export default ActivityFeedItem;
