import { ProfileDto } from "@alliance/shared/client/types.gen";
import { useUserFriendsQuery } from "@alliance/shared/lib/user";
import { loaderPrefetchStaleTime } from "@alliance/sharedweb/lib/queryClient";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Link } from "react-router";
import { SectionLoadState, SectionRefreshError } from "./SectionQueryState";

export default function UserFriendsSection({ userId }: { userId: number }) {
  const {
    data: friends,
    isError,
    isRefetchError,
  } = useUserFriendsQuery(userId, { staleTime: loaderPrefetchStaleTime });

  if (!friends) {
    return <SectionLoadState noun="friends" isError={isError} />;
  }

  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">
        Friends ({friends.length})
      </h2>
      {isRefetchError && <SectionRefreshError noun="friends" />}
      {friends.length ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {friends.map((friend) => (
            <FriendRow key={friend.id} friend={friend} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No friends yet.</p>
      )}
    </section>
  );
}

function FriendRow({ friend }: { friend: ProfileDto }) {
  return (
    <Link
      to={`/member/${friend.id}`}
      className="flex items-center gap-2 rounded px-1 py-1.5 hover:bg-zinc-50"
    >
      <AvatarProfile pfp={friend.profilePicture} size="small" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">
          {friend.displayName}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {formatFriendStatus(friend)}
        </p>
      </div>
    </Link>
  );
}

function formatFriendStatus(friend: ProfileDto) {
  const labels = [];
  if (friend.hasActiveContract) {
    labels.push("Signed");
  } else {
    labels.push("Not signed");
  }
  if (friend.ambassador) {
    labels.push("Ambassador");
  }
  if (friend.isCommunityLeader) {
    labels.push("Leader");
  }
  return labels.join(" · ");
}
