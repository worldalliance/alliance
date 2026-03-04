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
import { useMemo, useState } from "react";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

export enum MemberFilterMode {
  All = "All",
  FriendsOfFriends = "Friends of friends",
  Leads = "Leads",
  Staff = "Staff",
}

const MembersListPage = () => {
  const { user } = useAuth();

  const {
    data: members = [],
    isLoading: isLoadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: ["userMembersWithFriends", { requireSignedContract: true }],
    queryFn: () =>
      userMembersWithFriends({ query: { requireSignedContract: true } }).then(
        (res) => res.data?.filter((m) => !m.anonymous) ?? []
      ),
  });

  const { data: sentRequests = [], isLoading: isLoadingSentRequests } =
    useQuery({
      queryKey: ["userListSentRequests"],
      queryFn: () => userListSentRequests().then((res) => res.data ?? []),
    });

  const { data: friendsData = [], isLoading: isLoadingFriends } = useQuery({
    queryKey: ["userListFriends", user?.id],
    queryFn: () =>
      userListFriends({ path: { id: user!.id } }).then((res) => res.data ?? []),
    enabled: !!user,
  });

  const sentRequestIds = useMemo(
    () => new Set(sentRequests.map((req) => req.id)),
    [sentRequests]
  );

  const friendIds = useMemo(
    () => new Set(friendsData.map((friend) => friend.id)),
    [friendsData]
  );

  const loading = isLoadingMembers || isLoadingSentRequests || isLoadingFriends;
  const error = membersError ? "Could not load members" : null;

  const [params, setParams] = useSearchParams();

  const filterMode =
    (params.get("filter") as MemberFilterMode | undefined) ??
    MemberFilterMode.All;

  const [searchQuery, setSearchQuery] = useState("");

  const { allFriendsOfFriends, allOtherMembers, staffMembers, leadsMembers } =
    useMemo(() => {
      const fofs: ProfileDtoWithFriends[] = [];
      const fofIds = new Set<number>();
      for (const member of members) {
        if (
          member.id !== user?.id &&
          !friendIds.has(member.id) &&
          member.friends.some((f) => friendIds.has(f.id))
        ) {
          fofs.push(member);
          fofIds.add(member.id);
        }
      }
      const others = members.filter((m) => !fofIds.has(m.id));
      const staff = members.filter((m) => m.staff);
      const leads = members.filter((m) => m.isCommunityLeader);
      return {
        allFriendsOfFriends: fofs,
        allOtherMembers: others,
        staffMembers: staff,
        leadsMembers: leads,
      };
    }, [members, user?.id, friendIds]);

  const { friendsOfFriends, otherMembers, filteredStaffMembers, filteredLeadsMembers } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query)
      return {
        friendsOfFriends: allFriendsOfFriends,
        otherMembers: allOtherMembers,
        filteredStaffMembers: staffMembers,
        filteredLeadsMembers: leadsMembers,
      };
    const filterBySearch = (m: ProfileDtoWithFriends) =>
      m.displayName.toLowerCase().includes(query);
    return {
      friendsOfFriends: allFriendsOfFriends.filter(filterBySearch),
      otherMembers: allOtherMembers.filter(filterBySearch),
      filteredStaffMembers: staffMembers.filter(filterBySearch),
      filteredLeadsMembers: leadsMembers.filter(filterBySearch),
    };
  }, [searchQuery, allFriendsOfFriends, allOtherMembers, staffMembers, leadsMembers]);

  const secondaryLabels = {
    [MemberFilterMode.All]: members.length.toString(),
    [MemberFilterMode.FriendsOfFriends]: friendsOfFriends.length.toString(),
    [MemberFilterMode.Staff]: filteredStaffMembers.length.toString(),
    [MemberFilterMode.Leads]: filteredLeadsMembers.length.toString(),
  };

  const renderMembers = (list: ProfileDtoWithFriends[]) => (
    <List>
      {list.map((member) => (
        <MembersListItem
          key={member.id}
          profile={member}
          sentFriendRequest={sentRequestIds.has(member.id)}
          isFriend={friendIds.has(member.id)}
        />
      ))}
    </List>
  );

  return (
    <CenterLayout className="gap-y-4" width="3xl">
      <div className="md:mt-8 flex flex-row gap-x-6 items-center">
        <p className="text-2xl md:text-3xl font-serif font-medium">
          Members {members.length > 0 ? `(${members.length})` : ""}
        </p>

        <DropdownSelect
          options={MemberFilterMode}
          secondaryLabel={([, mode]) => secondaryLabels[mode]}
          value={filterMode}
          onChange={([, mode]) => setParams({ filter: mode })}
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
          <div className="w-full">
            <div className="relative">
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-zinc-200 py-2 px-3 rounded focus:outline-none"
              />
            </div>
          </div>

          {filterMode === MemberFilterMode.All && (
            <>
              {members.length > 0 ? (
                renderMembers([...friendsOfFriends, ...otherMembers])
              ) : (
                <p className="text-center text-zinc-500 py-4">None found</p>
              )}
            </>
          )}

          {filterMode === MemberFilterMode.FriendsOfFriends && (
            <>
              {friendsOfFriends.length > 0 ? (
                renderMembers(friendsOfFriends)
              ) : (
                <p className="text-center text-zinc-500 py-4">None found</p>
              )}
            </>
          )}

          {filterMode === MemberFilterMode.Leads && (
            <>
              {filteredLeadsMembers.length > 0 ? (
                renderMembers(filteredLeadsMembers)
              ) : (
                <p className="text-center text-zinc-500 py-4">None found</p>
              )}
            </>
          )}

          {filterMode === MemberFilterMode.Staff && (
            <>
              {filteredStaffMembers.length > 0 ? (
                renderMembers(filteredStaffMembers)
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
