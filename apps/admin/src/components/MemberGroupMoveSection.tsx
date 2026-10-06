import { userUserDetailAdmin } from "@alliance/shared/client";
import type {
  CommunityDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  MembershipChange,
  useChangeCommunityMembershipAdmin,
  useCommunitiesAdmin,
  useMoveCommunityMemberAdmin,
} from "../lib/useCommunitiesAdmin";

const NO_COMMUNITIES: CommunityDto[] = [];

export default function MemberGroupMoveSection({
  user,
  onUserUpdated,
}: {
  user: UserAdminDetailDto;
  onUserUpdated: (user: UserAdminDetailDto) => void;
}) {
  const {
    data: communities = NO_COMMUNITIES,
    isLoading: loadingCommunities,
    isLoadingError: communitiesLoadFailed,
    error: communitiesError,
  } = useCommunitiesAdmin();
  const { mutateAsync: moveMember } = useMoveCommunityMemberAdmin();
  const { mutateAsync: changeMembership } = useChangeCommunityMembershipAdmin();
  const [sourceCommunityId, setSourceCommunityId] = useState("");
  const [destinationCommunityId, setDestinationCommunityId] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const { confirm, success } = useToast();

  const userCommunities = useMemo(
    () => user.communities ?? [],
    [user.communities],
  );
  const leaderIdSet = useMemo(
    () => new Set(user.leaderOfIds ?? []),
    [user.leaderOfIds],
  );
  const memberCommunities = useMemo(
    () =>
      userCommunities
        .filter((community) => !leaderIdSet.has(community.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [leaderIdSet, userCommunities],
  );
  const leaderCommunities = useMemo(
    () =>
      userCommunities
        .filter((community) => leaderIdSet.has(community.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [leaderIdSet, userCommunities],
  );
  const currentCommunityIdSet = useMemo(
    () => new Set(userCommunities.map((community) => community.id)),
    [userCommunities],
  );
  const availableDestinations = useMemo(
    () =>
      communities
        .filter(
          (community) =>
            !currentCommunityIdSet.has(community.id) &&
            community.allowStaffAssignments &&
            community.maxCapacity !== null &&
            getMemberCount(community) < community.maxCapacity,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [communities, currentCommunityIdSet],
  );

  useEffect(() => {
    setSourceCommunityId((current) => {
      if (
        current &&
        memberCommunities.some(
          (community) => community.id.toString() === current,
        )
      ) {
        return current;
      }
      return memberCommunities.length === 1
        ? memberCommunities[0].id.toString()
        : "";
    });
  }, [memberCommunities]);

  useEffect(() => {
    setDestinationCommunityId((current) =>
      availableDestinations.some(
        (community) => community.id.toString() === current,
      )
        ? current
        : "",
    );
  }, [availableDestinations]);

  const handleMove = useCallback(async () => {
    const sourceCommunity = memberCommunities.find(
      (community) => community.id.toString() === sourceCommunityId,
    );
    const destinationCommunity = availableDestinations.find(
      (community) => community.id.toString() === destinationCommunityId,
    );
    if (
      !destinationCommunity ||
      (memberCommunities.length && !sourceCommunity)
    ) {
      return;
    }

    const confirmed = await confirm({
      title: sourceCommunity ? "Move member?" : "Assign member to group?",
      message: sourceCommunity
        ? `Move ${user.name} from ${sourceCommunity.name} to ${destinationCommunity.name}?`
        : `Assign ${user.name} to ${destinationCommunity.name}?`,
      confirmLabel: sourceCommunity ? "Move member" : "Assign member",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    setIsMoving(true);
    setMutationError(null);
    let membershipUpdated = false;
    try {
      if (sourceCommunity) {
        await moveMember({
          userId: user.id,
          sourceCommunityId: sourceCommunity.id,
          destinationCommunityId: destinationCommunity.id,
        });
      } else {
        await changeMembership({
          communityId: destinationCommunity.id,
          userId: user.id,
          change: MembershipChange.AddMember,
        });
      }
      membershipUpdated = true;

      const refreshedUser = await userUserDetailAdmin({
        path: { id: user.id },
        throwOnError: true,
      });
      onUserUpdated(refreshedUser.data);
      success(
        sourceCommunity ? "Member moved" : "Member assigned",
        destinationCommunity.name,
      );
    } catch (error) {
      if (membershipUpdated) {
        setMutationError(
          "Membership was updated, but the page could not refresh. Reload to see their latest groups.",
        );
      } else {
        setMutationError(
          adminRefusalMessage(
            error,
            sourceCommunity
              ? "Could not move this member."
              : "Could not assign this member.",
          ),
        );
      }
    } finally {
      setIsMoving(false);
    }
  }, [
    availableDestinations,
    changeMembership,
    confirm,
    destinationCommunityId,
    memberCommunities,
    moveMember,
    onUserUpdated,
    sourceCommunityId,
    success,
    user.id,
    user.name,
  ]);

  const needsSourceSelection = memberCommunities.length > 0;
  const canSubmit =
    user.hasActiveContract &&
    destinationCommunityId !== "" &&
    (!needsSourceSelection || sourceCommunityId !== "") &&
    !isMoving;

  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">Groups</h2>
      <div className="space-y-3">
        <div className="space-y-1">
          {memberCommunities.map((community) => (
            <Link
              key={community.id}
              to={`/groups/${community.id}`}
              className="block text-sm text-blue-600 hover:underline"
            >
              {community.name}
            </Link>
          ))}
          {!memberCommunities.length && (
            <p className="text-xs text-zinc-500">No current member group.</p>
          )}
          {leaderCommunities.map((community) => (
            <div
              key={community.id}
              className="flex items-center gap-1.5 text-xs"
            >
              <Link
                to={`/groups/${community.id}`}
                className="text-blue-600 hover:underline"
              >
                {community.name}
              </Link>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">
                Leader
              </span>
            </div>
          ))}
        </div>

        {needsSourceSelection && (
          <label className="block text-xs text-zinc-600">
            <span className="block mb-1">Move from</span>
            <select
              value={sourceCommunityId}
              onChange={(event) => setSourceCommunityId(event.target.value)}
              disabled={isMoving}
              className="w-full border border-zinc-300 rounded bg-white px-2 py-2 text-sm text-zinc-900"
            >
              <option value="">Select current group</option>
              {memberCommunities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs text-zinc-600">
          <span className="block mb-1">
            {needsSourceSelection ? "Move to" : "Assign to"}
          </span>
          <select
            value={destinationCommunityId}
            onChange={(event) => setDestinationCommunityId(event.target.value)}
            disabled={isMoving || !user.hasActiveContract}
            className="w-full border border-zinc-300 rounded bg-white px-2 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
          >
            <option value="">
              {loadingCommunities
                ? "Loading groups..."
                : "Select destination group"}
            </option>
            {availableDestinations.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </label>

        {!user.hasActiveContract && (
          <p className="text-xs text-amber-700">
            An active contract is required for group membership.
          </p>
        )}
        {communitiesLoadFailed && (
          <p className="text-xs text-red-500" role="alert">
            {adminRefusalMessage(communitiesError, "Unable to load groups.")}
          </p>
        )}
        {user.hasActiveContract &&
          !loadingCommunities &&
          !communitiesLoadFailed &&
          !availableDestinations.length && (
            <p className="text-xs text-zinc-500">
              No groups with staff assignments and available capacity.
            </p>
          )}
        {leaderCommunities.length > 0 && (
          <p className="text-xs text-zinc-500">
            Moving a member does not change groups they lead.
          </p>
        )}
        {mutationError && (
          <p className="text-xs text-red-500" role="alert">
            {mutationError}
          </p>
        )}
        <Button
          color={ButtonColor.Black}
          size="small"
          onClick={() => void handleMove()}
          disabled={!canSubmit}
        >
          {isMoving
            ? needsSourceSelection
              ? "Moving..."
              : "Assigning..."
            : needsSourceSelection
              ? "Move member"
              : "Assign member"}
        </Button>
      </div>
    </section>
  );
}
