import { withCount } from "@alliance/common/plural";
import {
  CommunityDto,
  communityJoinPublicCommunity,
  communityLeave,
  userJoinGroupAssignment,
  userLeaveGroupAssignment,
} from "@alliance/shared/client";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { requestGroupAssignmentConfirmation } from "@alliance/shared/lib/copy";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { usePublicCommunities } from "@alliance/shared/lib/usePublicCommunities";
import { cn } from "@alliance/shared/styles/util";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ChevronDown, ChevronLeft, Minus, Plus } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CommunityCreateForm from "../../components/CommunityCreateForm";
import CommunityInviteList from "../../components/CommunityInviteList";
import { useAuth } from "../../lib/AuthContext";

export type MyGroupsPageProps = {
  onSelectCommunity: (communityId: number | null | undefined) => void;
  onBack?: () => void;
};

const MyGroupsPage = ({ onSelectCommunity, onBack }: MyGroupsPageProps) => {
  const { user, refreshUser } = useAuth();
  const { communities, removeCommunity, refreshCommunities } = useMyCommunities(
    {
      selectedCommunityId: null,
    },
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [leavingCommunityId, setLeavingCommunityId] = useState<number | null>(
    null,
  );
  const justOpenedDialogRef = useRef(false);
  const { confirm, error: showError, success } = useToast();
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
  const {
    pendingCommunityInvites,
    incomingCommunityInvitesById,
    acceptCommunityInvite,
    declineCommunityInvite,
  } = useIncomingCommunityInvites();

  const handleDeclineInvite = useCallback(
    (inviteId: number) => {
      void declineCommunityInvite(inviteId);
    },
    [declineCommunityInvite],
  );

  const { leaderCommunities, nonLeaderCommunities } = useMemo(() => {
    return {
      leaderCommunities:
        communities?.filter((community) =>
          community.leaders.some((leader) => leader.id === user?.id),
        ) ?? [],
      nonLeaderCommunities:
        communities?.filter(
          (community) =>
            !community.leaders.some((leader) => leader.id === user?.id),
        ) ?? [],
    };
  }, [communities, user?.id]);

  const memberCommunityIds = useMemo(() => {
    return new Set((communities ?? []).map((community) => community.id));
  }, [communities]);

  const {
    publicCommunities,
    isLoading: publicCommunitiesLoading,
    isError: publicCommunitiesError,
    refetch: refetchPublicCommunities,
  } = usePublicCommunities();
  const [joiningCommunityId, setJoiningCommunityId] = useState<number | null>(
    null,
  );

  const getRemovalMessage = useCallback(
    (targetName?: string) => {
      if (!nonLeaderCommunities.length) {
        return null;
      }
      const names = nonLeaderCommunities.map((community) => community.name);
      const base =
        names.length === 1
          ? `your current group (${names[0]})`
          : `the following groups: (${names.join(", ")})`;
      if (!targetName) {
        return `You will be removed from ${base}.`;
      }
      return `Joining ${targetName} will remove you from ${base}.`;
    },
    [nonLeaderCommunities],
  );

  const handleAcceptInvite = useCallback(
    async (inviteId: number, anchor?: HTMLElement | null) => {
      const message = getRemovalMessage();
      const ok = message
        ? await confirm({
            title: "Accept invite?",
            message,
            confirmLabel: "Accept",
            cancelLabel: "Cancel",
            anchorEl: anchor,
            placement: "topleft",
          })
        : true;

      if (ok) {
        void acceptCommunityInvite(inviteId).then(() => {
          onSelectCommunity(
            incomingCommunityInvitesById.get(inviteId)?.community.id,
          );
        });
      }
    },
    [
      onSelectCommunity,
      incomingCommunityInvitesById,
      acceptCommunityInvite,
      confirm,
      getRemovalMessage,
    ],
  );

  const onLeaveGroup = useCallback(
    (community: CommunityDto) => {
      setLeavingCommunityId(community.id);
    },
    [setLeavingCommunityId],
  );

  const onConfirmLeaveGroup = useCallback(
    async (community: CommunityDto) => {
      const response = await communityLeave({
        path: { communityId: community.id },
      });
      if (response.data) {
        onSelectCommunity(null);
        setLeavingCommunityId(null);
        removeCommunity(community.id);
      }
    },
    [onSelectCommunity, removeCommunity],
  );

  const handleRequestAssignment = useCallback(
    async (anchor?: HTMLElement | null) => {
      const ok = !!nonLeaderCommunities.length
        ? await confirm({
            title: "Group assignment",
            message: requestGroupAssignmentConfirmation,
            confirmLabel: "Yes, reassign me",
            cancelLabel: "No",
            anchorEl: anchor,
            placement: "topleft",
          })
        : true;
      if (ok) {
        await userJoinGroupAssignment();
        await refreshUser();
      }
    },
    [confirm, nonLeaderCommunities.length, refreshUser],
  );

  const handleCancelAssignment = useCallback(async () => {
    await userLeaveGroupAssignment();
    await refreshUser();
  }, [refreshUser]);

  const handleJoinPublicCommunity = useCallback(
    async (community: CommunityDto, anchor?: HTMLElement | null) => {
      const message = getRemovalMessage(community.name);
      const ok = message
        ? await confirm({
            title: "Join public group?",
            message,
            confirmLabel: "Join group",
            cancelLabel: "Cancel",
            anchorEl: anchor,
            placement: "topleft",
          })
        : true;
      if (!ok) {
        return;
      }
      setJoiningCommunityId(community.id);
      try {
        const response = await communityJoinPublicCommunity({
          path: { communityId: community.id },
        });
        if (!response.data) {
          throw new Error("No group returned");
        }
        success(`You joined ${community.name}.`);
        await Promise.all([
          refreshUser(),
          refreshCommunities(),
          refetchPublicCommunities(),
        ]);
        onSelectCommunity(response.data.id);
      } catch (err) {
        console.error("Failed to join public group", err);
        showError("Unable to join that group right now.");
      } finally {
        setJoiningCommunityId(null);
      }
    },
    [
      confirm,
      getRemovalMessage,
      onSelectCommunity,
      refreshUser,
      refreshCommunities,
      refetchPublicCommunities,
      showError,
      success,
    ],
  );

  const handleCreateSuccess = useCallback(
    (community: CommunityDto) => {
      setShowCreateForm(false);
      onSelectCommunity(community.id);
    },
    [onSelectCommunity],
  );

  const handleCreateCancel = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  return (
    <div className="flex flex-col gap-y-12 py-8">
      {!!communities?.length && onBack && (
        <Button color={ButtonColor.White} onClick={onBack}>
          <ChevronLeft size="16" /> Back to group
        </Button>
      )}
      {/* Leader groups */}
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <p className="font-semibold text-xl md:text-2xl">Groups you lead</p>
          <p className="text-zinc-500 text-base">
            You can lead as many groups as you want.
          </p>
        </div>
        <List>
          {[
            ...(leaderCommunities.map((community) => {
              const memberCount = getMemberCount(community);
              return (
                <Button
                  key={community.id}
                  color={ButtonColor.White}
                  className="w-full !rounded-none border-none !p-4"
                  onClick={() => onSelectCommunity(community.id)}
                >
                  <div className={"w-full flex flex-row justify-between"}>
                    <div className="flex flex-row gap-x-3">
                      <AvatarProfile
                        pfp={community.photo ?? null}
                        size="huge"
                      />
                      <div className="flex flex-col text-left">
                        <p className="text-lg font-semibold">
                          {community.name}
                        </p>
                        <p className="text-zinc-500">{community.description}</p>
                        <span className="text-zinc-500">
                          {withCount(memberCount, "member")}
                        </span>
                      </div>
                    </div>
                  </div>
                </Button>
              );
            }) ?? []),
            <Fragment key="create-group">
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                color={showCreateForm ? ButtonColor.Light : ButtonColor.White}
                className={cn(
                  "w-full !rounded-none",
                  leaderCommunities.length
                    ? "border-t border-t-zinc-200 border-x-0 border-b-0"
                    : "border-0",
                )}
              >
                <div className="w-full flex flex-row gap-x-2 items-center justify-center p-2 text-zinc-500">
                  {showCreateForm ? <Minus size="14" /> : <Plus size="14" />}{" "}
                  Create group
                </div>
              </Button>
              {!!showCreateForm && (
                <div className="p-4 flex flex-col gap-y-4">
                  <CommunityCreateForm
                    name={user?.name}
                    onCancel={handleCreateCancel}
                    onSuccess={handleCreateSuccess}
                  />
                </div>
              )}
            </Fragment>,
          ]}
        </List>
      </div>

      {/* Non-leader groups */}
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2 md:flex-row w-full justify-between md:items-center">
          <div className="flex flex-col gap-y-1">
            <p className="font-semibold text-xl md:text-2xl">
              Groups you&apos;re a member of
              {!user?.undergoingGroupAssignment
                ? ""
                : nonLeaderCommunities.length
                  ? " (reassigning...)"
                  : " (assigning...)"}
            </p>
            <p className="text-zinc-500 text-base">
              For now, you can only be a member of one group.
            </p>
          </div>
          {user?.undergoingGroupAssignment ? (
            <Button color={ButtonColor.Black} onClick={handleCancelAssignment}>
              {nonLeaderCommunities.length
                ? "Cancel reassignment"
                : "Cancel assignment"}
            </Button>
          ) : nonLeaderCommunities.length ? (
            <Button
              className="justify-self-end"
              color={ButtonColor.Grey}
              onClick={(event) =>
                void handleRequestAssignment(event.currentTarget)
              }
            >
              Request reassignment
            </Button>
          ) : null}
        </div>
        {nonLeaderCommunities.length ? (
          <List>
            {nonLeaderCommunities.map((community) => {
              const memberCount = getMemberCount(community);
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
                      <div className="flex flex-row gap-x-3">
                        <AvatarProfile
                          pfp={community.photo ?? null}
                          size="huge"
                        />
                        <div className="flex flex-col text-left">
                          <p className="text-lg font-semibold">
                            {community.name}
                          </p>
                          <p className="text-zinc-500">
                            {community.description}
                          </p>
                          <span className="text-zinc-500">
                            {withCount(memberCount, "member")}
                          </span>
                        </div>
                      </div>
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
                            assign you to a new group. This process may take a
                            few days.
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
                            onClick={() => {
                              void (async () => {
                                setLeavingCommunityId(null);
                                await userJoinGroupAssignment();
                                await refreshUser();
                              })();
                            }}
                          >
                            Request reassignment
                          </Button>
                        )}
                        <Button
                          color={ButtonColor.Red}
                          size="small"
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
        ) : (
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

      {/* Pending group invites */}
      {!!pendingCommunityInvites.length && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl md:text-2xl">
            You have pending group invites
          </p>
          <CommunityInviteList
            invites={pendingCommunityInvites}
            onAccept={handleAcceptInvite}
            onDecline={handleDeclineInvite}
          />
        </div>
      )}

      {/* Public groups */}
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <p className="font-semibold text-xl md:text-2xl">Public groups</p>
          <p className="text-zinc-500 text-base">
            Groups you can join at any time.
          </p>
        </div>

        {publicCommunitiesLoading ? (
          <div className="flex flex-row items-center gap-x-2 text-zinc-500">
            <Spinner size="small" />
            <span>Loading public groups...</span>
          </div>
        ) : publicCommunitiesError ? (
          <span className="text-red-500">Unable to load public groups.</span>
        ) : publicCommunities.length ? (
          <List>
            {publicCommunities.map((community) => {
              const isMember = memberCommunityIds.has(community.id);
              const isLeader = community.leaders.some(
                (leader) => leader.id === user?.id,
              );
              const memberCount = getMemberCount(community);
              const isFull =
                community.maxCapacity !== null &&
                memberCount >= community.maxCapacity;
              const isJoining = joiningCommunityId === community.id;
              const joinDisabled = isMember || isLeader || isFull || isJoining;

              const joinLabel = isLeader
                ? "Leader"
                : isMember
                  ? "Member"
                  : isFull
                    ? "Full"
                    : isJoining
                      ? "Joining..."
                      : "Join";

              return (
                <div
                  key={community.id}
                  className="flex flex-col gap-y-2 p-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex flex-row gap-x-3">
                    <AvatarProfile pfp={community.photo ?? null} size="huge" />
                    <div className="flex flex-col">
                      <p className="text-lg font-semibold">{community.name}</p>
                      {community.description && (
                        <p className="text-zinc-500">{community.description}</p>
                      )}
                      <span className="text-zinc-500">
                        {memberCount}
                        {community.maxCapacity !== null
                          ? ` / ${Math.max(community.maxCapacity, memberCount)}`
                          : ""}{" "}
                        members
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end md:justify-start">
                    <Button
                      color={ButtonColor.Black}
                      size="small"
                      disabled={joinDisabled}
                      onClick={(event) =>
                        void handleJoinPublicCommunity(
                          community,
                          event.currentTarget,
                        )
                      }
                    >
                      {joinLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </List>
        ) : (
          <span>No public groups are available right now.</span>
        )}
      </div>
    </div>
  );
};

export default MyGroupsPage;
