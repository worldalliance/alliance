import {
  ProfileDtoWithFriends,
  userListFriends,
  userListSentRequests,
  userMembersWithFriends,
} from "@alliance/shared/client";

import MembersListItem from "../../components/MembersListItem";
import List from "@alliance/sharedweb/ui/List";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import { useAuth } from "../../lib/AuthContext";
import { useEffect, useState } from "react";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Spinner from "@alliance/sharedweb/ui/Spinner";

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
          userMembersWithFriends({ query: { requireSignedContract: true } }),
          userListSentRequests(),
        ]);

        setMembers(membersRes.data ?? []);
        setUserSentFriendRequestIds(
          sentRequestsRes.data?.map((req) => req.id) ?? []
        );
      } catch {
        setError("Could not load members");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const loadMyFriends = async () => {
      if (!user) return;
      const friendsRes = await userListFriends({ path: { id: user.id } });
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

  const otherMembers = members.filter(
    (member) => !friendsOfFriends.some((fof) => fof.id === member.id)
  );

  const secondaryLabels = {
    [MemberFilterMode.All]: members.length.toString(),
    [MemberFilterMode.FriendsOfFriends]: friendsOfFriends.length.toString(),
  };

  const renderMembers = (list: ProfileDtoWithFriends[]) => (
    <List>
      {list.map((member) => (
        <MembersListItem
          key={member.id}
          profile={member}
          sentFriendRequest={userSentFriendRequestIds.includes(member.id)}
          isFriend={myFriends.includes(member.id)}
        />
      ))}
    </List>
  );

  return (
    <CenterLayout className="gap-y-4" width="3xl">
      <div className="md:mt-8 flex flex-row gap-x-6 items-center">
        <p className="text-2xl md:text-3xl font-serif font-medium">
          Members ({members.length})
        </p>

        <DropdownSelect
          options={MemberFilterMode}
          secondaryLabel={(_, mode) => secondaryLabels[mode]}
          value={filterMode}
          onChange={(_, mode) => setFilterMode(mode)}
        />
      </div>

      {loading && (
        <div className="mx-auto">
          <Spinner />
        </div>
      )}

      {error && <BasicErrorMessage>{error}</BasicErrorMessage>}

      {!loading && !error && (
        <>
          {(filterMode === MemberFilterMode.All ||
            filterMode === MemberFilterMode.FriendsOfFriends) && (
            <>
              <p className="font-medium text-zinc-500 mt-4">
                Friends of friends ({friendsOfFriends.length})
              </p>
              {friendsOfFriends.length > 0 ? (
                renderMembers(friendsOfFriends)
              ) : (
                <p className="text-center text-zinc-500 py-4">None found</p>
              )}
            </>
          )}

          {filterMode === MemberFilterMode.All && (
            <>
              <p className="font-medium text-zinc-500 mt-4">
                Others ({otherMembers.length})
              </p>
              {otherMembers.length > 0 ? (
                renderMembers(otherMembers)
              ) : (
                <p className="text-center text-zinc-500 py-4">None found</p>
              )}
            </>
          )}
        </>
      )}
    </CenterLayout>
  );
};

export default MembersListPage;
