import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { userGetCommunities } from "@alliance/shared/client";
import type { CommunityDto } from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { useGroupAssignment } from "../lib/GroupAssignmentContext";

const GroupAssignmentPage: React.FC = () => {
  const { membersUndergoingGroupAssignment } = useGroupAssignment();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [communitiesError, setCommunitiesError] = useState<string | null>(null);
  const [assignmentSelections, setAssignmentSelections] = useState<
    Record<number, string>
  >({});
  const storageKey = "admin.groupAssignmentSelections";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        const next: Record<number, string> = {};
        Object.entries(parsed).forEach(([memberId, communityId]) => {
          if (communityId) {
            next[Number(memberId)] = communityId;
          }
        });
        setAssignmentSelections((prev) => ({ ...next, ...prev }));
      }
    } catch (error) {
      console.warn("Failed to read group assignment selections", error);
    }
  }, [storageKey]);

  useEffect(() => {
    setAssignmentSelections((prev) => {
      const next = { ...prev };
      membersUndergoingGroupAssignment.forEach((member) => {
        if (!(member.id in next)) {
          next[member.id] = "";
        }
      });
      return next;
    });
  }, [membersUndergoingGroupAssignment]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const serializable = Object.fromEntries(
        Object.entries(assignmentSelections).filter(([, value]) => value)
      );
      window.localStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch (error) {
      console.warn("Failed to save group assignment selections", error);
    }
  }, [assignmentSelections, storageKey]);

  useEffect(() => {
    const loadCommunities = async () => {
      setLoadingCommunities(true);
      setCommunitiesError(null);
      try {
        const response = await userGetCommunities();
        setCommunities(response.data ?? []);
      } catch (error) {
        console.error("Failed to load communities", error);
        setCommunitiesError("Unable to load groups. Please try again.");
      } finally {
        setLoadingCommunities(false);
      }
    };

    void loadCommunities();
  }, []);

  const membersCount = membersUndergoingGroupAssignment.length;
  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [communities]);
  const groupOptions = useMemo(() => {
    const placeholder = {
      value: "",
      label: loadingCommunities ? "Loading groups..." : "Select group",
    };
    const options = sortedCommunities.map((community) => ({
      value: community.id.toString(),
      label: community.name,
    }));
    return [placeholder, ...options];
  }, [loadingCommunities, sortedCommunities]);

  const memberGroupsByMemberId = useMemo(
    () =>
      new Map(
        membersUndergoingGroupAssignment.map((member) => [
          member.id,
          member.communities.filter(
            (community) =>
              !community.leaders!.some((leader) => leader.id === member.id)
          ),
        ])
      ),

    [membersUndergoingGroupAssignment]
  );

  const handleSelectionChange = useCallback(
    (memberId: number) => (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setAssignmentSelections((prev) => ({
        ...prev,
        [memberId]: value,
      }));
    },
    []
  );

  const selectedCommunityByMemberId = useMemo(() => {
    const communityById = new Map(
      communities.map((community) => [community.id.toString(), community])
    );
    return new Map(
      Object.entries(assignmentSelections)
        .map(([memberId, communityId]) => {
          const selected = communityById.get(communityId);
          return selected ? [Number(memberId), selected] : null;
        })
        .filter((entry): entry is [number, CommunityDto] => entry !== null)
    );
  }, [assignmentSelections, communities]);

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4 bg-zinc-50">
      <div className="w-full max-w-6xl flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-semibold">Group assignment</h2>
          <Button
            type="button"
            color={ButtonColor.Green}
            onClick={() => undefined}
            className="self-start md:self-auto"
          >
            Confirm assignments
          </Button>
        </div>

        {communitiesError && (
          <p className="text-sm text-red-500">{communitiesError}</p>
        )}

        {membersCount ? (
          <List className="bg-white">
            {membersUndergoingGroupAssignment.map((member) => {
              const selection = assignmentSelections[member.id] ?? "";
              const memberGroups = memberGroupsByMemberId.get(member.id) ?? [];
              const selectedCommunity = selectedCommunityByMemberId.get(
                member.id
              );
              return (
                <div
                  key={member.id}
                  className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <ProfileImage pfp={member.profilePicture} size="medium" />
                    <div className="flex flex-col gap-1">
                      <Link
                        to={`/member/${member.id}`}
                        className="font-semibold text-zinc-900 hover:underline"
                      >
                        {member.name}
                      </Link>
                      <div className="text-sm text-zinc-500">
                        {member.email}
                        {member.phoneNumber ? ` • ${member.phoneNumber}` : ""}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                        {memberGroups.length ? (
                          memberGroups.map((community) => (
                            <Button
                              key={`${member.id}-${community.id}`}
                              type="button"
                              color={ButtonColor.Light}
                              className="text-xs"
                              onClick={() =>
                                navigate(
                                  `/groups/${community.id}?from=group-assignment`
                                )
                              }
                            >
                              {community.name}
                            </Button>
                          ))
                        ) : (
                          <div>No current group</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[220px]">
                    <label
                      className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
                      htmlFor={`member-${member.id}-group`}
                    >
                      New group
                    </label>
                    <select
                      id={`member-${member.id}-group`}
                      className="border border-zinc-300 rounded px-3 py-2 text-sm bg-white"
                      value={selection}
                      onChange={handleSelectionChange(member.id)}
                      disabled={loadingCommunities}
                    >
                      {groupOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {selectedCommunity && (
                      <Button
                        type="button"
                        color={ButtonColor.Light}
                        className="text-xs self-end"
                        onClick={() =>
                          navigate(
                            `/groups/${selectedCommunity.id}?from=group-assignment`
                          )
                        }
                      >
                        View group
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </List>
        ) : (
          <p className="text-sm text-zinc-500">
            No members currently awaiting assignment.
          </p>
        )}
      </div>
    </div>
  );
};

export default GroupAssignmentPage;
