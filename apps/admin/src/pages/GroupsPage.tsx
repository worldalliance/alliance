import React, { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link } from "react-router";
import {
  userCreateCommunityAdmin,
  userGetCommunities,
} from "@alliance/shared/client";
import type {
  CommunityDto,
  CreateCommunityDto,
} from "@alliance/shared/client/types.gen";
import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";
import GroupAssignmentPanel from "../components/GroupAssignmentPanel";
import { useGroupAssignment } from "../lib/GroupAssignmentContext";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";

const INITIAL_COMMUNITY: CreateCommunityDto = {
  name: "",
  description: "",
  photo: "",
  public: false,
  maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
};

const GroupsPage: React.FC = () => {
  const { membersUndergoingGroupAssignment, assignMembers } =
    useGroupAssignment();
  const [pendingAssignmentsByCommunityId, setPendingAssignmentsByCommunityId] =
    useState<Record<number, number>>({});
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommunity, setNewCommunity] =
    useState<CreateCommunityDto>(INITIAL_COMMUNITY);
  const [creating, setCreating] = useState(false);
  const [allowStaffAssignments, setAllowStaffAssignments] = useState(true);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userGetCommunities();
      setCommunities(response.data ?? []);
    } catch (err) {
      console.error("Failed to load communities", err);
      setError("Unable to load communities. Please try again.");
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
        .localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
    );
  }, [communities]);

  const totalUnusedCapacity = useMemo(() => {
    return communities.reduce((total, community) => {
      if (community.maxCapacity === null) {
        return total;
      }
      const pending = pendingAssignmentsByCommunityId[community.id] ?? 0;
      const remaining =
        community.maxCapacity - community.users.length - pending;
      return total + Math.max(remaining, 0);
    }, 0);
  }, [communities, pendingAssignmentsByCommunityId]);

  const handleCreateCommunity = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = newCommunity.name.trim();
      const description = newCommunity.description.trim();
      const photo = newCommunity.photo?.trim();
      const requiresMaxCapacity = newCommunity.public || allowStaffAssignments;
      const normalizedMaxCapacity = requiresMaxCapacity
        ? newCommunity.maxCapacity
        : null;
      if (!name || !description) {
        setError("Name and description are required.");
        return;
      }
      if (requiresMaxCapacity) {
        if (!normalizedMaxCapacity || normalizedMaxCapacity <= 0) {
          setError("Member capacity is required.");
          return;
        }
      }
      setCreating(true);
      setError(null);
      try {
        const response = await userCreateCommunityAdmin({
          body: {
            name,
            description,
            photo: photo ? photo : undefined,
            public: newCommunity.public,
            maxCapacity: normalizedMaxCapacity,
          },
        });
        if (response.data) {
          setCommunities((prev) => [...prev, response.data]);
          setNewCommunity(INITIAL_COMMUNITY);
          setAllowStaffAssignments(true);
        }
      } catch (err) {
        console.error("Failed to create community", err);
        setError("Unable to create community. Please try again.");
      } finally {
        setCreating(false);
      }
    },
    [newCommunity, allowStaffAssignments]
  );

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4">
      {error && (
        <div className="w-full max-w-5xl">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

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

        <Card style={CardStyle.White}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">Unused capacity</p>
            <p className="text-2xl font-semibold text-zinc-900">
              {totalUnusedCapacity}
            </p>
          </div>
        </Card>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading groups…</p>
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
              onChange={(event) => {
                setError(null);
                setNewCommunity((prev) => ({
                  ...prev,
                  name: event.target.value,
                }));
              }}
              placeholder="Member-visible title"
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
              onChange={(event) => {
                setError(null);
                setNewCommunity((prev) => ({
                  ...prev,
                  description: event.target.value,
                }));
              }}
              placeholder="What is this group for?"
            />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-col gap-y-3">
              <label
                className="flex items-center gap-x-2 text-sm font-medium text-zinc-700"
                htmlFor="group-public"
              >
                <input
                  id="group-public"
                  type="checkbox"
                  checked={newCommunity.public}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setError(null);
                    setNewCommunity((prev) => ({
                      ...prev,
                      public: checked,
                    }));
                    if (checked) {
                      setAllowStaffAssignments(true);
                    }
                  }}
                />
                Public
              </label>
              <label
                className="flex items-center gap-x-2 text-sm font-medium text-zinc-700"
                htmlFor="group-assignments"
              >
                <input
                  id="group-assignments"
                  type="checkbox"
                  checked={allowStaffAssignments}
                  onChange={(event) => {
                    setError(null);
                    setAllowStaffAssignments(event.target.checked);
                  }}
                  disabled={newCommunity.public}
                />
                Group assignment
              </label>
            </div>
            {(newCommunity.public || allowStaffAssignments) && (
              <div className="mt-4">
                <label
                  className="text-sm font-medium text-zinc-700"
                  htmlFor="group-capacity"
                >
                  Member capacity
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
                    setError(null);
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
  const memberCount = community.users.length;
  const effectiveMemberCount = memberCount + pendingAssignments;
  const leaderCount = community.leaders.length;
  const capacity = community.maxCapacity;

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
              className={`flex flex-col items-end gap-1 text-sm ${
                community.public ? "text-green" : "text-zinc-400"
              }`}
            >
              {community.public ? "Public" : "Private"}
            </div>
            {leaderCount !== 1 && (
              <p className="text-sm text-zinc-600">
                {leaderCount} leader{leaderCount === 1 ? "" : "s"}
              </p>
            )}
            <p
              className={`text-sm mr-4 font-medium ${
                capacity !== null && effectiveMemberCount >= capacity
                  ? "text-zinc-400"
                  : ""
              }`}
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
