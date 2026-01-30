import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  userAssignGroupsAdmin,
  userGetCommunities,
} from "@alliance/shared/client";
import type {
  AssignGroupsDto,
  CommunityDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import List from "@alliance/sharedweb/ui/List";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { CardStyle } from "@alliance/shared/styles/card";
import ConfirmDialog from "./ConfirmDialog";

const storageKey = "admin.groupAssignmentSelections";

type GroupAssignmentPanelProps = {
  members: UserDto[];
  assignMembers: (memberIds: number[]) => void;
  onSelectionCountsChange?: (counts: Record<number, number>) => void;
};

const GroupAssignmentPanel: React.FC<GroupAssignmentPanelProps> = ({
  members,
  assignMembers,
  onSelectionCountsChange,
}) => {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [communitiesError, setCommunitiesError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [assignmentSelections, setAssignmentSelections] = useState<
    Record<number, string>
  >({});

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
  }, []);

  useEffect(() => {
    setAssignmentSelections((prev) => {
      const memberIds = new Set(members.map((member) => member.id));
      const next: Record<number, string> = {};
      // Only keep selections for members who are still in the menu
      Object.entries(prev).forEach(([memberId, communityId]) => {
        if (memberIds.has(Number(memberId))) {
          next[Number(memberId)] = communityId;
        }
      });
      // Ensure all current members have entries
      members.forEach((member) => {
        if (!(member.id in next)) {
          next[member.id] = "";
        }
      });
      return next;
    });
  }, [members]);

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
  }, [assignmentSelections]);

  useEffect(() => {
    if (!members.length) {
      return;
    }
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
  }, [members.length]);

  const membersCount = members.length;
  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) =>
      a.name
        .trim()
        .localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
    );
  }, [communities]);

  const memberGroupsByMemberId = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          member.communities.filter(
            (community) =>
              !community.leaders?.some((leader) => leader.id === member.id)
          ),
        ])
      ),

    [members]
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

  const pendingAssignmentsByCommunityId = useMemo(() => {
    const counts: Record<number, number> = {};
    selectedCommunityByMemberId.forEach((community) => {
      counts[community.id] = (counts[community.id] ?? 0) + 1;
    });
    return counts;
  }, [selectedCommunityByMemberId]);

  useEffect(() => {
    if (onSelectionCountsChange) {
      onSelectionCountsChange(pendingAssignmentsByCommunityId);
    }
  }, [onSelectionCountsChange, pendingAssignmentsByCommunityId]);

  const assignmentPreview = useMemo(
    () =>
      members
        .map((member) => {
          const community = selectedCommunityByMemberId.get(member.id);
          return community ? { member, community } : null;
        })
        .filter(
          (
            entry
          ): entry is {
            member: (typeof members)[number];
            community: CommunityDto;
          } => entry !== null
        ),
    [members, selectedCommunityByMemberId]
  );

  const hasSelections = assignmentPreview.length > 0;
  const invalidCommunityIds = useMemo(() => {
    return new Set(
      communities
        .filter((community) => community.maxCapacity === null)
        .map((community) => community.id)
    );
  }, [communities]);
  const hasInvalidSelections = useMemo(
    () =>
      Array.from(selectedCommunityByMemberId.values()).some((community) =>
        invalidCommunityIds.has(community.id)
      ),
    [invalidCommunityIds, selectedCommunityByMemberId]
  );
  const overCapacityByCommunityId = useMemo(() => {
    const overages = new Map<number, number>();
    communities.forEach((community) => {
      if (community.maxCapacity === null) return;
      const currentCount = community.users.length;
      const pending = pendingAssignmentsByCommunityId[community.id] ?? 0;
      const total = currentCount + pending;
      if (pending > 0 && total > community.maxCapacity) {
        overages.set(community.id, total - community.maxCapacity);
      }
    });
    return overages;
  }, [communities, pendingAssignmentsByCommunityId]);
  const hasOverCapacitySelections = overCapacityByCommunityId.size > 0;

  useEffect(() => {
    if (showValidationError && hasSelections) {
      setShowValidationError(false);
    }
  }, [showValidationError, hasSelections]);

  const confirmMessage = useMemo(() => {
    if (!assignmentPreview.length) {
      return "No group assignments are selected.";
    }
    const lines = assignmentPreview.map(({ member, community }) => {
      const currentGroups =
        memberGroupsByMemberId
          .get(member.id)
          ?.map((group) => group.name)
          .sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
          ) ?? [];
      const groupTransitionSummary = currentGroups.length
        ? `(Remove from: ${currentGroups.join(", ")}) -> ${community.name}`
        : community.name;
      return `${member.name}: ${groupTransitionSummary}`;
    });
    return `You're about to assign ${assignmentPreview.length} member${assignmentPreview.length === 1 ? "" : "s"
      }:\n\n${lines.join("\n")}`;
  }, [assignmentPreview, memberGroupsByMemberId]);

  const canConfirm =
    membersCount > 0 &&
    !loadingCommunities &&
    hasSelections &&
    !hasOverCapacitySelections &&
    !hasInvalidSelections;

  const buildGroupOptions = useCallback(
    (selection: string) => {
      const placeholder = {
        value: "",
        label: loadingCommunities ? "Loading groups..." : "Select group",
      };
      const options = sortedCommunities
        .filter((community) => {
          if (community.maxCapacity === null) return false;
          const pending = pendingAssignmentsByCommunityId[community.id] ?? 0;
          const isSelected = selection === community.id.toString();
          if (isSelected) return true;
          return community.users.length + pending < community.maxCapacity;
        })
        .map((community) => ({
          value: community.id.toString(),
          label: community.name,
        }));
      return [placeholder, ...options];
    },
    [loadingCommunities, pendingAssignmentsByCommunityId, sortedCommunities]
  );

  const handleOpenConfirm = useCallback(() => {
    if (!canConfirm) {
      setShowValidationError(true);
      return;
    }
    setShowValidationError(false);
    setSubmissionError(null);
    setIsConfirmOpen(true);
  }, [canConfirm]);

  const handleCloseConfirm = useCallback(() => {
    if (isSubmitting) return;
    setIsConfirmOpen(false);
  }, [isSubmitting]);

  const handleConfirmAssignments = useCallback(async () => {
    if (!assignmentPreview.length) {
      return;
    }
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const body: AssignGroupsDto = {
        assignments: assignmentPreview.map(({ member, community }) => ({
          userId: member.id,
          communityId: community.id,
        })),
      };
      const response = await userAssignGroupsAdmin({ body });
      if (response.data) {
        assignMembers(body.assignments.map(({ userId }) => userId));
        setAssignmentSelections((prev) => {
          const next = { ...prev };
          body.assignments.forEach((assignment) => {
            delete next[assignment.userId];
          });
          return next;
        });
        if (typeof window !== "undefined") {
          try {
            const stored = window.localStorage.getItem(storageKey);
            if (stored) {
              const parsed = JSON.parse(stored) as Record<string, string>;
              body.assignments.forEach((assignment) => {
                delete parsed[String(assignment.userId)];
              });
              window.localStorage.setItem(storageKey, JSON.stringify(parsed));
            }
          } catch (error) {
            console.warn("Failed to update saved assignments", error);
          }
        }
      } else {
        setSubmissionError("Failed to assign members");
      }
      setIsConfirmOpen(false);
    } catch (error) {
      console.error("Failed to assign groups", error);
      setSubmissionError("Unable to confirm assignments. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [assignmentPreview, assignMembers]);

  return (
    <Card className="w-full max-w-5xl" style={CardStyle.White}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-semibold">Group assignment</h2>
          <Button
            type="button"
            color={ButtonColor.Green}
            onClick={handleOpenConfirm}
            disabled={!canConfirm || isSubmitting}
            className="self-start md:self-auto"
          >
            Confirm assignments
          </Button>
        </div>

        {communitiesError && (
          <p className="text-sm text-red-500">{communitiesError}</p>
        )}
        {submissionError && (
          <p className="text-sm text-red-500">{submissionError}</p>
        )}
        {showValidationError && !hasSelections && (
          <p className="text-sm text-amber-600">
            Select at least one group assignment before confirming.
          </p>
        )}

        {membersCount ? (
          <List className="bg-white">
            {members.map((member) => {
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
                                navigate(`/groups/${community.id}?from=groups`)
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
                      {buildGroupOptions(selection).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {selectedCommunity &&
                      overCapacityByCommunityId.has(selectedCommunity.id) && (
                        <p className="text-xs text-red-600">
                          Over capacity by{" "}
                          {overCapacityByCommunityId.get(selectedCommunity.id)}.
                        </p>
                      )}
                    {selectedCommunity &&
                      invalidCommunityIds.has(selectedCommunity.id) && (
                        <p className="text-xs text-red-600">
                          This group is not available for assignment.
                        </p>
                      )}
                    {selectedCommunity && (
                      <Button
                        type="button"
                        color={ButtonColor.Light}
                        className="text-xs self-end"
                        onClick={() =>
                          navigate(
                            `/groups/${selectedCommunity.id}?from=groups`
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

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Confirm group assignments"
        message={confirmMessage}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={handleConfirmAssignments}
        onCancel={handleCloseConfirm}
        isLoading={isSubmitting}
      />
    </Card>
  );
};

export default GroupAssignmentPanel;
