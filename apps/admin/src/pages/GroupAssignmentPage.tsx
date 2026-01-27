import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  userAssignGroupsAdmin,
  userGetCommunities,
} from "@alliance/shared/client";
import type {
  AssignGroupsDto,
  CommunityDto,
} from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import ConfirmDialog from "../components/ConfirmDialog";
import { useGroupAssignment } from "../lib/GroupAssignmentContext";

const storageKey = "admin.groupAssignmentSelections";
const GroupAssignmentPage: React.FC = () => {
  const { membersUndergoingGroupAssignment, assignMembers } =
    useGroupAssignment();
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

  const assignmentPreview = useMemo(
    () =>
      membersUndergoingGroupAssignment
        .map((member) => {
          const community = selectedCommunityByMemberId.get(member.id);
          return community ? { member, community } : null;
        })
        .filter(
          (
            entry
          ): entry is {
            member: (typeof membersUndergoingGroupAssignment)[number];
            community: CommunityDto;
          } => entry !== null
        ),
    [membersUndergoingGroupAssignment, selectedCommunityByMemberId]
  );

  const hasSelections = assignmentPreview.length > 0;

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
    return `You're about to assign ${assignmentPreview.length} member${
      assignmentPreview.length === 1 ? "" : "s"
    }:\n\n${lines.join("\n")}`;
  }, [assignmentPreview, memberGroupsByMemberId]);

  const canConfirm = membersCount > 0 && !loadingCommunities && hasSelections;

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
  }, [assignmentPreview, storageKey, assignMembers]);

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4 bg-zinc-50">
      <div className="w-full max-w-6xl flex flex-col gap-6">
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
    </div>
  );
};

export default GroupAssignmentPage;
