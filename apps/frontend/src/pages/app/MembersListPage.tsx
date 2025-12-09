import {
  ProfileDtoWithFriends,
  userListFriends,
  userListSentRequests,
  userMembersWithFriends,
} from "@alliance/shared/client";

import MembersListItem from "../../components/MembersListItem";
import List from "@alliance/shared/ui/List";
import DropdownSelect from "@alliance/shared/ui/DropdownSelect";
import { useAuth } from "../../lib/AuthContext";
import { useEffect, useState } from "react";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import CenterLayout from "@alliance/shared/ui/CenterLayout";
import Spinner from "../../components/Spinner";

export enum MemberFilterMode {
  All = "All",
  FriendsOfFriends = "Friends of friends",
}

const MembersListPage = () => {
  const { user } = useAuth();

  const [members, setMembers] = useState<ProfileDtoWithFriends[]>([]);
  const [userSentFriendRequestIds, setUserSentFriendRequestIds] = useState<
    number[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myFriends, setMyFriends] = useState<number[]>([]);

  const [filterMode, setFilterMode] = useState<MemberFilterMode>(
    MemberFilterMode.All
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [membersRes, sentRequestsRes] = await Promise.all([
          userMembersWithFriends({
            query: { requireSignedContract: true },
          }),
          userListSentRequests(),
        ]);

        setMembers(membersRes.data ?? []);
        setUserSentFriendRequestIds(
          sentRequestsRes.data ? sentRequestsRes.data.map((req) => req.id) : []
        );
      } catch {
        setError("Could not load members");
        setMembers([]);
        setUserSentFriendRequestIds([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const loadMyFriends = async () => {
      if (!user) return;
      const friendsRes = await userListFriends({
        path: { id: user.id },
      });
      if (!friendsRes.data) return;
      setMyFriends(friendsRes.data.map((friend) => friend.id));
    };
    loadMyFriends();
  }, [user]);

  const friendsOfFriends = members.filter(
    (member) =>
      member.id !== user?.id &&
      !myFriends.includes(member.id) &&
      member.friends.some((friend) => myFriends.includes(friend.id))
  );

  // Put friends of friends at top to make them easier to find
  const sortedMembers = [...members].sort((a, b) => {
    const aIsFriendOfFriend =
      a.id !== user?.id &&
      !myFriends.includes(a.id) &&
      a.friends.some((friend) => myFriends.includes(friend.id));
    const bIsFriendOfFriend =
      b.id !== user?.id &&
      !myFriends.includes(b.id) &&
      b.friends.some((friend) => myFriends.includes(friend.id));

    if (aIsFriendOfFriend && !bIsFriendOfFriend) return -1;
    if (!aIsFriendOfFriend && bIsFriendOfFriend) return 1;
    return 0;
  });

  const selectedMembers =
    filterMode === MemberFilterMode.All ? sortedMembers : friendsOfFriends;

  return (
    <CenterLayout className="gap-y-4" width="3xl">
      <div className="md:mt-8 flex flex-row gap-x-6 items-center">
        <p className="text-2xl md:text-3xl font-serif font-medium relative w-fit -mt-1">
          Members
        </p>

        <DropdownSelect
          options={Object.values(MemberFilterMode)}
          secondaryLabels={Object.values(MemberFilterMode).map((mode) =>
            mode === MemberFilterMode.All
              ? members.length.toString()
              : friendsOfFriends.length.toString()
          )}
          value={filterMode}
          onChange={(value) => {
            setFilterMode(value as MemberFilterMode);
          }}
        />
      </div>

      {loading && (
        <div className="mx-auto">
          <Spinner />
        </div>
      )}
      {error && <BasicErrorMessage>{error}</BasicErrorMessage>}

      {selectedMembers.length > 0 ? (
        <List>
          {selectedMembers.map((member) => (
            <MembersListItem
              key={member.id}
              profile={member}
              sentFriendRequest={userSentFriendRequestIds?.includes(member.id)}
              isFriend={myFriends.includes(member.id)}
            />
          ))}
        </List>
      ) : (
        <>
          {!loading && (
            <p className="text-center text-zinc-500 py-5">None found</p>
          )}
        </>
      )}
    </CenterLayout>
  );
};

export default MembersListPage;
