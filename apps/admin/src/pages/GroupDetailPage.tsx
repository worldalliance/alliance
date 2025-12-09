import React, { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link, useNavigate, useParams } from "react-router";
import {
  userAddLeaderToCommunity,
  userAddMemberToCommunity,
  userDeleteCommunity,
  userGetCommunities,
  userList,
  userRemoveLeaderFromCommunity,
  userRemoveMemberFromCommunity,
  userUpdateCommunity,
} from "@alliance/shared/client";
import type {
  CommunityDto,
  UpdateCommunityDto,
} from "@alliance/shared/client/types.gen";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import UserSelect, { UserSelectUser } from "@alliance/shared/ui/UserSelect";
import { useToast } from "@alliance/shared/ui/ToastProvider";

const CommunityDetailPage: React.FC = () => {
  const { id } = useParams();
  const communityId = Number(id);
  const navigate = useNavigate();

  const [community, setCommunity] = useState<CommunityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    description: "",
    photo: "",
  });
  const [users, setUsers] = useState<UserSelectUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [memberSelection, setMemberSelection] = useState<number[]>([]);
  const [leaderSelection, setLeaderSelection] = useState<number[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [addingLeader, setAddingLeader] = useState(false);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<number>>(
    () => new Set<number>()
  );
  const [pendingLeaderIds, setPendingLeaderIds] = useState<Set<number>>(
    () => new Set<number>()
  );
  const { confirm, success, error: pushError } = useToast();

  const loadCommunity = useCallback(async () => {
    if (Number.isNaN(communityId)) {
      setError("Invalid community id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await userGetCommunities();
      const match =
        response.data?.find((candidate) => candidate.id === communityId) ??
        null;
      if (!match) {
        setError("Community not found.");
      }
      setCommunity(match);
    } catch (err) {
      console.error("Failed to load community", err);
      setError("Unable to load community. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    void loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    setUsersLoading(true);
    userList()
      .then((response) => {
        const rawUsers = response.data ?? [];
        setUsers(
          rawUsers.map((user) => ({
            id: user.id,
            name: user.name ?? `User #${user.id}`,
            profilePicture: user.profilePicture ?? null,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to load users", err);
      })
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    if (community) {
      setFormValues({
        name: community.name,
        description: community.description,
        photo: community.photo ?? "",
      });
    }
  }, [community]);

  const handleUpdateDetails = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!community) return;
    const payload: UpdateCommunityDto = {
      name: formValues.name.trim(),
      description: formValues.description.trim(),
      photo: formValues.photo.trim() ? formValues.photo.trim() : undefined,
    };
    if (!payload.name || !payload.description) {
      setError("Name and description are required.");
      return;
    }
    setSavingDetails(true);
    setError(null);
    try {
      const response = await userUpdateCommunity({
        path: { communityId },
        body: payload,
      });
      if (response.data) {
        setCommunity(response.data);
        success("Community updated", response.data.name);
      }
    } catch (err) {
      console.error("Failed to update community", err);
      setError("Unable to update community. Please try again.");
      pushError("Unable to update community. Please try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  const mutateMembers = useCallback(
    async (
      action:
        | "add"
        | "remove"
        | "add-leader"
        | "remove-leader"
        | "promote-leader",
      userId?: number
    ) => {
      if (!community) {
        return;
      }
      try {
        switch (action) {
          case "add": {
            if (!memberSelection.length) return;
            setAddingMember(true);
            const response = await userAddMemberToCommunity({
              path: { communityId },
              body: { userId: memberSelection[0] },
            });
            if (response.data) {
              setCommunity(response.data);
              setMemberSelection([]);
            }
            setAddingMember(false);
            break;
          }
          case "remove": {
            if (!userId) return;
            setPendingMemberIds((prev) => {
              const next = new Set(prev);
              next.add(userId);
              return next;
            });
            const response = await userRemoveMemberFromCommunity({
              path: { communityId },
              body: { userId },
            });
            if (response.data) {
              setCommunity(response.data);
            }
            setPendingMemberIds((prev) => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
            break;
          }
          case "add-leader": {
            if (!leaderSelection.length) return;
            setAddingLeader(true);
            const response = await userAddLeaderToCommunity({
              path: { communityId },
              body: { userId: leaderSelection[0] },
            });
            if (response.data) {
              setCommunity(response.data);
              setLeaderSelection([]);
            }
            setAddingLeader(false);
            break;
          }
          case "promote-leader": {
            if (!userId) return;
            setPendingLeaderIds((prev) => {
              const next = new Set(prev);
              next.add(userId);
              return next;
            });
            const response = await userAddLeaderToCommunity({
              path: { communityId },
              body: { userId },
            });
            if (response.data) {
              setCommunity(response.data);
            }
            setPendingLeaderIds((prev) => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
            break;
          }
          case "remove-leader": {
            if (!userId) return;
            setPendingLeaderIds((prev) => {
              const next = new Set(prev);
              next.add(userId);
              return next;
            });
            const response = await userRemoveLeaderFromCommunity({
              path: { communityId },
              body: { userId },
            });
            if (response.data) {
              setCommunity(response.data);
            }
            setPendingLeaderIds((prev) => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
            break;
          }
        }
      } catch (err) {
        console.error("Community mutation failed", err);
        setError("Operation failed. Please try again.");
        setAddingMember(false);
        setAddingLeader(false);
        pushError("Community update failed. Please try again.");
        if (userId) {
          setPendingMemberIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          setPendingLeaderIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        }
      }
    },
    [
      communityId,
      leaderSelection,
      memberSelection,
      community,
      pushError,
      setAddingLeader,
    ]
  );

  const handleDelete = async () => {
    if (!community) return;
    const confirmed = await confirm({
      title: `Delete ${community.name}?`,
      message:
        "All members and leaders will lose this community assignment. This action cannot be undone.",
      confirmLabel: "Delete community",
      cancelLabel: "Cancel",
      mode: "fullscreen",
    });
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await userDeleteCommunity({ path: { communityId } });
      success("Community deleted", community.name);
      navigate(href("/groups"));
    } catch (err) {
      console.error("Failed to delete community", err);
      setError("Unable to delete community. Please try again.");
      pushError("Unable to delete community. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const leaderIds = useMemo(() => {
    return new Set(community?.leaders.map((leader) => leader.id) ?? []);
  }, [community]);

  const sortedMembers = useMemo(() => {
    return [...(community?.users ?? [])].sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        sensitivity: "base",
      })
    );
  }, [community]);

  const sortedLeaders = useMemo(() => {
    return [...(community?.leaders ?? [])].sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        sensitivity: "base",
      })
    );
  }, [community]);

  const confirmLeaderPromotion = useCallback(
    async (
      event: React.MouseEvent<HTMLElement>,
      userId: number,
      displayName?: string | null
    ) => {
      if (!community) return;
      const anchorEl = event.currentTarget;
      const ok = await confirm({
        title: "Make leader?",
        message: `Promote ${displayName ?? "this member"} to a leader of ${
          community.name
        }?`,
        confirmLabel: "Make leader",
        cancelLabel: "Cancel",
        anchorEl,
        placement: "top",
        mode: "popover",
      });
      if (!ok) {
        return;
      }
      await mutateMembers("promote-leader", userId);
    },
    [community, confirm, mutateMembers]
  );

  if (loading) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-zinc-500">Loading community…</p>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="p-6 pt-20">
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <p className="text-sm text-zinc-500">Community not found.</p>
        )}
        <Link
          to={href("/groups")}
          className="text-blue-600 text-sm hover:underline"
        >
          ← Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 pt-20 flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-row items-center justify-between gap-3">
        <div>
          <Link
            to={href("/groups")}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to groups
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{community.name}</h1>
          <p className="text-sm text-zinc-500">
            Manage group details, membership, and leadership.
          </p>
        </div>
        <Button
          type="button"
          color={ButtonColor.Red}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete group"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <Card style={CardStyle.White}>
        <form className="flex flex-col gap-4" onSubmit={handleUpdateDetails}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Name</label>
            <input
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 text-sm"
              value={formValues.name}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">
              Description
            </label>
            <textarea
              className="border border-zinc-300 rounded px-3 py-2 text-sm min-h-[80px]"
              value={formValues.description}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <Button
            type="submit"
            color={ButtonColor.Blue}
            className="self-start"
            disabled={savingDetails}
          >
            {savingDetails ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card style={CardStyle.White}>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-lg">Members</h2>
              <p className="text-sm text-zinc-500">
                {community.users.length} total members
              </p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void mutateMembers("add");
              }}
            >
              <UserSelect
                users={users}
                selectedUserIds={memberSelection}
                onChange={setMemberSelection}
                loading={usersLoading}
                label="Add member"
                single
              />
              <Button
                type="submit"
                color={ButtonColor.Blue}
                className="self-start"
                disabled={addingMember || memberSelection.length === 0}
              >
                {addingMember ? "Adding…" : "Add member"}
              </Button>
            </form>
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
              {sortedMembers.length ? (
                sortedMembers.map((member) => {
                  const isLeader = leaderIds.has(member.id);
                  const memberPending = pendingMemberIds.has(member.id);
                  const leaderPending = pendingLeaderIds.has(member.id);
                  return (
                    <div
                      key={member.id}
                      className="flex flex-row items-center justify-between border border-zinc-200 rounded px-3 py-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">
                          {member.displayName ?? `User #${member.id}`}
                        </span>
                        {isLeader && (
                          <span className="text-xs text-zinc-500">Leader</span>
                        )}
                      </div>
                      <div className="flex flex-row gap-2">
                        {!isLeader && (
                          <Button
                            type="button"
                            color={ButtonColor.Light}
                            className="text-xs"
                            onClick={(event) =>
                              void confirmLeaderPromotion(
                                event,
                                member.id,
                                member.displayName
                              )
                            }
                            disabled={leaderPending}
                          >
                            {leaderPending ? "Updating…" : "Make leader"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          color={ButtonColor.Red}
                          className="text-xs"
                          onClick={() =>
                            void mutateMembers("remove", member.id)
                          }
                          disabled={memberPending}
                        >
                          {memberPending ? "Removing…" : "Remove"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">
                  No members yet. Add someone above.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card style={CardStyle.White}>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-lg">Leaders</h2>
              <p className="text-sm text-zinc-500">
                {community.leaders.length} total leaders
              </p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void mutateMembers("add-leader");
              }}
            >
              <UserSelect
                users={users}
                selectedUserIds={leaderSelection}
                onChange={setLeaderSelection}
                loading={usersLoading}
                label="Add leader"
                single
              />
              <Button
                type="submit"
                color={ButtonColor.Blue}
                className="self-start"
                disabled={addingLeader || leaderSelection.length === 0}
              >
                {addingLeader ? "Adding…" : "Add leader"}
              </Button>
            </form>
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
              {sortedLeaders.length ? (
                sortedLeaders.map((leader) => {
                  const leaderPending = pendingLeaderIds.has(leader.id);
                  return (
                    <div
                      key={leader.id}
                      className="flex flex-row items-center justify-between border border-zinc-200 rounded px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {leader.displayName ?? `User #${leader.id}`}
                        </span>
                      </div>
                      <Button
                        type="button"
                        color={ButtonColor.Light}
                        className="text-xs"
                        onClick={() =>
                          void mutateMembers("remove-leader", leader.id)
                        }
                        disabled={leaderPending}
                      >
                        {leaderPending ? "Updating…" : "Remove leader"}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">
                  No leaders yet. Promote a member or add directly.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CommunityDetailPage;
