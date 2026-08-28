import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@alliance/common/community";
import { errorMessage } from "@alliance/common/errorMessage";
import { withCount } from "@alliance/common/plural";
import {
  communityCreateCommunityAdmin,
  communityGetCommunitiesAdmin,
} from "@alliance/shared/client";
import type {
  CommunityDto,
  CreateCommunityDto,
} from "@alliance/shared/client/types.gen";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";
import { groupSettings } from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CharacterLimitNotice from "@alliance/sharedweb/ui/CharacterLimitNotice";
import List from "@alliance/sharedweb/ui/List";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link } from "react-router";
import GroupAssignmentPanel from "../components/GroupAssignmentPanel";
import { useGroupAssignment } from "../lib/GroupAssignmentContext";

const INITIAL_COMMUNITY: CreateCommunityDto = {
  name: "",
  description: "",
  photo: "",
  public: false,
  allowMemberInvites: true,
  allowStaffAssignments: true,
  maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
};

const GroupsPage: React.FC = () => {
  const { membersUndergoingGroupAssignment, assignMembers } =
    useGroupAssignment();
  const [pendingAssignmentsByCommunityId, setPendingAssignmentsByCommunityId] =
    useState<Record<number, number>>({});
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newCommunity, setNewCommunity] =
    useState<CreateCommunityDto>(INITIAL_COMMUNITY);
  const [creating, setCreating] = useState(false);

  const requiresMaxCapacity =
    newCommunity.public ||
    newCommunity.allowStaffAssignments ||
    newCommunity.allowMemberInvites;

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await communityGetCommunitiesAdmin();
      if (!response.data) {
        setLoadError(
          errorMessage({
            error: response.error,
            fallback: "Unable to load communities. Please try again.",
          }),
        );
        return;
      }
      setCommunities(response.data);
    } catch (err) {
      console.error("Failed to load communities", err);
      setLoadError("Unable to load communities. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    if (membersUndergoingGroupAssignment.length === 0) {
      setPendingAssignmentsByCommunityId({});
    }
  }, [membersUndergoingGroupAssignment.length]);

  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) =>
      a.name
        .trim()
        .localeCompare(b.name.trim(), undefined, { sensitivity: "base" }),
    );
  }, [communities]);

  const totalUnusedCapacity = useMemo(() => {
    return Math.max(
      0,
      communities.reduce((acc, community) => {
        if (community.maxCapacity === null) {
          return acc;
        }
        return (
          acc + Math.max(0, community.maxCapacity - getMemberCount(community))
        );
      }, 0) - membersUndergoingGroupAssignment.length,
    );
  }, [communities, membersUndergoingGroupAssignment.length]);

  const handleCreateCommunity = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = newCommunity.name.trim();
      const description = newCommunity.description.trim();
      const photo = newCommunity.photo?.trim();
      let normalizedMaxCapacity: number | null = null;
      if (requiresMaxCapacity) {
        if (!newCommunity.maxCapacity || newCommunity.maxCapacity <= 0) {
          setCreateError("Member capacity is required.");
          return;
        }
        normalizedMaxCapacity = newCommunity.maxCapacity;
      }
      if (!name || !description) {
        setCreateError("Name and description are required.");
        return;
      }
      setCreating(true);
      setCreateError(null);
      try {
        const response = await communityCreateCommunityAdmin({
          body: {
            name,
            description,
            photo: photo ? photo : undefined,
            public: newCommunity.public,
            allowMemberInvites: newCommunity.allowMemberInvites,
            allowStaffAssignments: newCommunity.allowStaffAssignments,
            maxCapacity: normalizedMaxCapacity,
          },
        });
        if (response.data) {
          setCommunities((prev) => [...prev, response.data]);
          setNewCommunity(INITIAL_COMMUNITY);
        } else {
          setCreateError(
            errorMessage({
              error: response.error,
              fallback: "Unable to create community. Please try again.",
            }),
          );
        }
      } catch (err) {
        console.error("Failed to create community", err);
        setCreateError("Unable to create community. Please try again.");
      } finally {
        setCreating(false);
      }
    },
    [newCommunity, requiresMaxCapacity],
  );

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4">
      {membersUndergoingGroupAssignment.length > 0 && (
        <GroupAssignmentPanel
          members={membersUndergoingGroupAssignment}
          assignMembers={assignMembers}
          onSelectionCountsChange={setPendingAssignmentsByCommunityId}
        />
      )}

      <div className="w-full max-w-5xl flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Groups</h2>
            <p className="text-sm text-zinc-500">
              Manage member-facing groups and their details.
            </p>
          </div>
        </div>

        {!loadError && (
          <Card style={CardStyle.White}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">
                Unused capacity
              </p>
              <p className="text-2xl font-semibold text-zinc-900">
                {totalUnusedCapacity}
              </p>
            </div>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading groups…</p>
        ) : loadError ? (
          <p className="text-sm text-red-500">{loadError}</p>
        ) : sortedCommunities.length ? (
          <List>
            {sortedCommunities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                pendingAssignments={
                  pendingAssignmentsByCommunityId[community.id] ?? 0
                }
              />
            ))}
          </List>
        ) : (
          <p className="text-sm text-zinc-500">No groups yet.</p>
        )}
      </div>

      <Card className="w-full max-w-5xl" style={CardStyle.White}>
        <p className="font-bold mb-4">Create group</p>
        <form className="flex flex-col gap-3" onSubmit={handleCreateCommunity}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-zinc-700"
              htmlFor="group-name"
            >
              Name
            </label>
            <input
              id="group-name"
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 text-sm"
              value={newCommunity.name}
              maxLength={COMMUNITY_NAME_MAX_LENGTH}
              onChange={(event) => {
                setCreateError(null);
                setNewCommunity((prev) => ({
                  ...prev,
                  name: event.target.value,
                }));
              }}
              placeholder="Member-visible title"
            />
            <CharacterLimitNotice
              value={newCommunity.name}
              max={COMMUNITY_NAME_MAX_LENGTH}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-zinc-700"
              htmlFor="group-description"
            >
              Description
            </label>
            <textarea
              id="community-description"
              className="border border-zinc-300 rounded px-3 py-2 text-sm min-h-[80px]"
              value={newCommunity.description}
              maxLength={COMMUNITY_DESCRIPTION_MAX_LENGTH}
              onChange={(event) => {
                setCreateError(null);
                setNewCommunity((prev) => ({
                  ...prev,
                  description: event.target.value,
                }));
              }}
              placeholder="What is this group for?"
            />
            <CharacterLimitNotice
              value={newCommunity.description}
              max={COMMUNITY_DESCRIPTION_MAX_LENGTH}
            />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-col gap-y-3">
              <label
                className="flex items-start gap-x-2 text-sm font-medium text-zinc-700"
                htmlFor="group-public"
              >
                <input
                  id="group-public"
                  type="checkbox"
                  checked={newCommunity.public}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setCreateError(null);
                    setNewCommunity((prev) => ({
                      ...prev,
                      public: checked,
                      allowMemberInvites: true,
                      allowStaffAssignments: true,
                    }));
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="text-base font-medium">
                    {groupSettings.public.name}
                  </p>
                  <p className="text-sm text-zinc-500 font-normal">
                    {groupSettings.public.explanation}
                  </p>
                </div>
              </label>
              <label
                className="flex items-start gap-x-2 text-sm font-medium text-zinc-700"
                htmlFor="member-invites"
              >
                <input
                  id="member-invites"
                  type="checkbox"
                  checked={newCommunity.allowMemberInvites}
                  onChange={(event) => {
                    setCreateError(null);
                    setNewCommunity((prev) => ({
                      ...prev,
                      allowMemberInvites: event.target.checked,
                    }));
                  }}
                  disabled={newCommunity.public}
                  className="mt-1"
                />
                <div>
                  <p className="text-base font-medium">
                    {groupSettings.allowMemberInvites.name}
                  </p>
                  <p className="text-sm text-zinc-500 font-normal">
                    {groupSettings.allowMemberInvites.explanation}
                  </p>
                </div>
              </label>
              <label
                className="flex items-start gap-x-2 text-sm font-medium text-zinc-700"
                htmlFor="staff-assignments"
              >
                <input
                  id="staff-assignments"
                  type="checkbox"
                  checked={newCommunity.allowStaffAssignments}
                  onChange={(event) => {
                    setCreateError(null);
                    setNewCommunity((prev) => ({
                      ...prev,
                      allowStaffAssignments: event.target.checked,
                    }));
                  }}
                  disabled={newCommunity.public}
                  className="mt-1"
                />
                <div>
                  <p className="text-base font-medium">
                    {groupSettings.allowStaffAssignments.name}
                  </p>
                  <p className="text-sm text-zinc-500 font-normal">
                    {groupSettings.allowStaffAssignments.explanation}
                  </p>
                </div>
              </label>
            </div>
            {requiresMaxCapacity && (
              <div className="mt-4">
                <label
                  className="text-black font-medium"
                  htmlFor="group-capacity"
                >
                  <p className="text-base font-medium">
                    {groupSettings.maxCapacity.name}
                  </p>
                  <p className="text-sm text-zinc-500 font-normal">
                    {groupSettings.maxCapacity.explanation}
                  </p>
                </label>
                <input
                  id="group-capacity"
                  type="number"
                  min={1}
                  className="mt-2 border border-zinc-300 rounded px-3 py-2 text-sm w-full bg-white"
                  value={newCommunity.maxCapacity ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    const parsed = Number(value);
                    setCreateError(null);
                    setNewCommunity((prev) => ({
                      ...prev,
                      maxCapacity:
                        value === "" || Number.isNaN(parsed) ? null : parsed,
                    }));
                  }}
                />
              </div>
            )}
          </div>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <Button
            type="submit"
            color={ButtonColor.Blue}
            className="self-start"
            disabled={creating}
          >
            {creating ? "Creating…" : "Create group"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

type CommunityCardProps = {
  community: CommunityDto;
  pendingAssignments: number;
};

const CommunityCard: React.FC<CommunityCardProps> = ({
  community,
  pendingAssignments,
}) => {
  const memberCount = getMemberCount(community);
  const effectiveMemberCount = memberCount + pendingAssignments;
  const leaderCount = community.leaders.length;
  const capacity = community.allowStaffAssignments
    ? community.maxCapacity
    : null;

  return (
    <Link
      to={href("/groups/:id", { id: community.id.toString() })}
      className="p-4 hover:bg-zinc-100 cursor-pointer"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">{community.name}</h3>
            <p className="text-sm text-zinc-600">
              {community.description || "No description yet."}
            </p>
          </div>
          <div className="flex flex-row items-center gap-3">
            <div
              className={cn(
                "flex flex-col items-end gap-1 text-sm",
                community.public ? "text-green" : "text-zinc-400",
              )}
            >
              {community.public ? "Public" : "Private"}
            </div>
            {leaderCount !== 1 && (
              <p className="text-sm text-zinc-600">
                {withCount(leaderCount, "leader")}
              </p>
            )}
            <p
              className={cn(
                "text-sm mr-4 font-medium",
                capacity !== null &&
                  effectiveMemberCount >= capacity &&
                  "text-zinc-400",
              )}
            >
              {memberCount}
              {pendingAssignments > 0 ? ` (+${pendingAssignments})` : ""}
              {capacity ? ` / ${capacity}` : ""}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default GroupsPage;
