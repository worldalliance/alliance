import { ProfileDto } from "@alliance/shared/client";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Link, href } from "react-router";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";

export interface MembersListCardProps {
  profile: ProfileDto;
  sentFriendRequest?: boolean;
  isFriend?: boolean;
}

export default function MembersListItem({
  profile,
  sentFriendRequest,
  isFriend,
}: MembersListCardProps) {
  return (
    <Link
      to={href("/member/:id", { id: profile.id.toString() })}
      className="p-3 hover:bg-zinc-50"
    >
      <div className="flex flex-row items-center justify-between space-x-2">
        <div className="flex flex-row items-center">
          <AvatarProfile
            pfp={profile.profilePicture}
            size="medium"
            className="mr-2"
          />
          <UserDisplayName
            staff={profile.staff}
            ambassador={profile.ambassador}
            grouplead={profile.isCommunityLeader}
            underline={false}
          >
            {profile.displayName}
          </UserDisplayName>
        </div>
        {sentFriendRequest && (
          <div className="text-sm text-zinc-500 bg-zinc-100 py-1 px-2 rounded">
            Request sent
          </div>
        )}
        {isFriend && (
          <div className="text-sm text-zinc-500 bg-zinc-100 py-1 px-2 rounded">
            Friend
          </div>
        )}
      </div>
    </Link>
  );
}
