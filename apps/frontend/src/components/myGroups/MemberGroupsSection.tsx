import { CommunityDto, communityLeave } from "@alliance/shared/client";
import { groupAssignmentLabels } from "@alliance/shared/lib/communityUtils";
import { requestGroupAssignmentConfirmation } from "@alliance/shared/lib/copy";
import { useGroupAssignment } from "@alliance/shared/lib/useGroupAssignment";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import MyGroupSummary from "./MyGroupSummary";

export type MemberGroupsSectionProps = {
  communities: CommunityDto[];
  didGroupsFail: boolean;
  onSelectCommunity: (communityId: number | null) => void;
  removeCommunity: (communityId: number) => void;
};

const MemberGroupsSection = ({
  communities,
  didGroupsFail,
  onSelectCommunity,
  removeCommunity,
}: MemberGroupsSectionProps) => {
  const { user, refreshUser } = useAuth();
  const [leavingCommunityId, setLeavingCommunityId] = useState<number | null>(
    null,
  );
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const justOpenedDialogRef = useRef(false);
  const { confirm, error: showError } = useToast();
  const handleCloseLeaveGroupConfirmation = useCallback(() => {
    if (justOpenedDialogRef.current) {
      return;
    }
    setLeavingCommunityId(null);
  }, []);
  const confirmationDialogRef = useOutsideClick(
    handleCloseLeaveGroupConfirmation,
  );

  useEffect(() => {
    if (leavingCommunityId !== null) {
      justOpenedDialogRef.current = true;
      const timer = setTimeout(() => {
        justOpenedDialogRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [leavingCommunityId]);

  const assignmentLabels = groupAssignmentLabels({
    isMember: communities.length > 0,
    didGroupsFail,
  });

  const onLeaveGroup = useCallback(
    (community: CommunityDto) => {
      setLeavingCommunityId(community.id);
    },
    [setLeavingCommunityId],
  );

  const onConfirmLeaveGroup = useCallback(
    async (community: CommunityDto) => {
      setIsLeavingGroup(true);
      try {
        await communityLeave({
          path: { communityId: community.id },
          throwOnError: true,
        });
      } catch (err) {
        console.error("Failed to leave group", err);
        showError("Unable to leave that group right now.");
        return;
      } finally {
        setIsLeavingGroup(false);
      }
      onSelectCommunity(null);
      setLeavingCommunityId(null);
      removeCommunity(community.id);
    },
    [onSelectCommunity, removeCommunity, showError],
  );

  const { join, leave } = useGroupAssignment({ onChanged: refreshUser });
  const assignmentBusy = join.isPending || leave.isPending;

  const joinGroupAssignment = useCallback(() => {
    join.mutate(undefined, {
      onError: (err) => {
        console.error("Failed to request group assignment", err);
        showError("Unable to request group assignment right now.");
      },
    });
  }, [join, showError]);

  const handleRequestAssignment = useCallback(
    async (anchor?: HTMLElement | null) => {
      const ok = !!communities.length
        ? await confirm({
            title: "Group assignment",
            message: requestGroupAssignmentConfirmation,
            confirmLabel: "Yes, reassign me",
            cancelLabel: "No",
            anchorEl: anchor,
            placement: ToastPlacement.TopLeft,
          })
        : true;
      if (ok) {
        joinGroupAssignment();
      }
    },
    [confirm, joinGroupAssignment, communities.length],
  );

  const handleCancelAssignment = useCallback(() => {
    leave.mutate(undefined, {
      onError: (err) => {
        console.error("Failed to cancel group assignment", err);
        showError("Unable to cancel group assignment right now.");
      },
    });
  }, [leave, showError]);

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2 md:flex-row w-full justify-between md:items-center">
        <div className="flex flex-col gap-y-1">
          <p className="font-semibold text-xl md:text-2xl">
            Groups you&apos;re a member of
            {user?.undergoingGroupAssignment
              ? assignmentLabels.headingSuffix
              : ""}
          </p>
          <p className="text-zinc-500 text-base">
            For now, you can only be a member of one group.
          </p>
        </div>
        {user?.undergoingGroupAssignment ? (
          <Button
            color={ButtonColor.Black}
            disabled={assignmentBusy}
            onClick={handleCancelAssignment}
          >
            {assignmentLabels.cancelLabel}
          </Button>
        ) : communities.length ? (
          <Button
            className="justify-self-end"
            color={ButtonColor.Grey}
            disabled={assignmentBusy}
            onClick={(event) =>
              void handleRequestAssignment(event.currentTarget)
            }
          >
            Request reassignment
          </Button>
        ) : null}
      </div>
      {communities.length ? (
        <List>
          {communities.map((community) => {
            const isShowingConfirmation = leavingCommunityId === community.id;
            return (
              <div key={community.id}>
                <Button
                  color={ButtonColor.White}
                  className="w-full !rounded-none border-none !p-4"
                  onClick={() => {
                    if (!isShowingConfirmation) {
                      onSelectCommunity(community.id);
                    }
                  }}
                  asDiv={true}
                >
                  <div className={"w-full flex flex-row justify-between"}>
                    <MyGroupSummary community={community} />
                    {!isShowingConfirmation && (
                      <Button
                        color={ButtonColor.Red}
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          onLeaveGroup(community);
                        }}
                      >
                        Leave <ChevronDown size="14" />
                      </Button>
                    )}
                  </div>
                </Button>
                {isShowingConfirmation && (
                  <div
                    ref={confirmationDialogRef}
                    className="p-4 bg-zinc-50 border-t border-zinc-200"
                  >
                    <div className="flex flex-col gap-y-2 mb-4">
                      {!user?.undergoingGroupAssignment && (
                        <p className="text-zinc-700">
                          We recommend that you join the group assignment
                          process instead of leaving the group, which will
                          assign you to a new group. This process may take a few
                          days.
                        </p>
                      )}
                      <p className="text-zinc-700">
                        Are you sure you want to leave the group? You will not
                        be able to rejoin unless you are invited again.
                      </p>
                    </div>
                    <div className="flex flex-row gap-x-2 justify-end">
                      <Button
                        color={ButtonColor.White}
                        size="small"
                        onClick={() => setLeavingCommunityId(null)}
                      >
                        Cancel
                      </Button>
                      {!user?.undergoingGroupAssignment && (
                        <Button
                          color={ButtonColor.Black}
                          size="small"
                          disabled={assignmentBusy}
                          onClick={() => {
                            setLeavingCommunityId(null);
                            joinGroupAssignment();
                          }}
                        >
                          Request reassignment
                        </Button>
                      )}
                      <Button
                        color={ButtonColor.Red}
                        size="small"
                        disabled={isLeavingGroup}
                        onClick={() => {
                          onConfirmLeaveGroup(community);
                        }}
                      >
                        Leave group
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </List>
      ) : didGroupsFail ? null : (
        <div className="flex flex-col gap-y-2 mx-auto items-center py-4">
          <span>
            You are not a member of any group.
            {user &&
              user.undergoingGroupAssignment &&
              " Staff will assign you to a group in a few days."}
          </span>
          {user && !user.undergoingGroupAssignment && (
            <Button
              color={ButtonColor.Black}
              disabled={assignmentBusy}
              onClick={(event) =>
                void handleRequestAssignment(event.currentTarget)
              }
            >
              Request assignment
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberGroupsSection;
