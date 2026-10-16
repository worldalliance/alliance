import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import {
  actionsActionRelationsForUserAdmin,
  contractSuspendContractAdmin,
  notifsNotifsForUserAdmin,
  tasksGetFormsForUserSidAdmin,
  userGetTagSummariesAdmin,
  userListFriends,
  userUserDetailAdmin,
} from "@alliance/shared/client";
import {
  ProfileDto,
  UserActionRelationDetailDto,
  UserActionRelationsResponseDto,
  UserActionSummaryDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Mail, Phone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { Route } from "../../.react-router/types/src/pages/+types/UserDetailView";
import DeleteAccountModal from "../components/DeleteAccountModal";
import MemberGroupMoveSection from "../components/MemberGroupMoveSection";
import UserAwayPeriodsSection from "../components/UserAwayPeriodsSection";
import UserActionsSection from "../components/user-detail/UserActionsSection";
import UserMemberInfoSection from "../components/user-detail/UserMemberInfoSection";
import UserNotificationsSection from "../components/user-detail/UserNotificationsSection";
import UserRolesSection from "../components/user-detail/UserRolesSection";
import UserTagsSection from "../components/user-detail/UserTagsSection";
import { getApiUrl } from "../lib/config";
import { useUserAwayRangesAdmin } from "../lib/useUserAwayRangesAdmin";

export async function clientLoader({ params }: Route.LoaderArgs) {
  const userIdParam = params.userId;
  if (!userIdParam) {
    throw new Error("Not found");
  }
  const userId = Number.parseInt(userIdParam, 10);
  if (Number.isNaN(userId)) {
    throw new Error("Not found");
  }

  const [
    userRes,
    tagsRes,
    actionRelationsRes,
    notifRes,
    formResponsesRes,
    friendsRes,
  ] = await Promise.all([
    userUserDetailAdmin({ path: { id: userId } }),
    userGetTagSummariesAdmin(),
    actionsActionRelationsForUserAdmin({ path: { userId } }),
    notifsNotifsForUserAdmin({ path: { id: userId } }),
    tasksGetFormsForUserSidAdmin({ path: { userId } }).catch(() => ({
      data: [],
    })),
    userListFriends({ path: { id: userId } }),
  ]);

  const user = userRes.data;
  if (!user) {
    throw new Error("Not found");
  }

  const actionData: UserActionRelationsResponseDto | undefined =
    actionRelationsRes.data;
  const actionSummaries: UserActionSummaryDto[] = actionData?.actions ?? [];
  const actionRelations: UserActionRelationDetailDto[] =
    actionData?.users?.find((entry) => entry.userId === userId)?.relations ??
    [];

  return {
    user,
    allTags: tagsRes.data ?? [],
    actionSummaries,
    actionRelations,
    notifs: notifRes.data ?? [],
    formResponses: formResponsesRes.data ?? [],
    friends: friendsRes.data ?? [],
  };
}

const UserDetailView: React.FC = () => {
  const loaderData = useLoaderData<typeof clientLoader>();
  const { actionSummaries, actionRelations, notifs, formResponses, friends } =
    loaderData;

  const [user, setUser] = useState<UserAdminDetailDto>(loaderData.user);
  const [isSuspendPending, setIsSuspendPending] = useState(false);
  const [suspendMutationError, setSuspendMutationError] = useState<
    string | null
  >(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { confirm, success } = useToast();

  useEffect(() => {
    setUser(loaderData.user);
  }, [loaderData.user]);

  const navigate = useNavigate();

  const { currentAwayRange } = useUserAwayRangesAdmin(user.id);

  const latestEvent = user.lastContractEvent ?? null;

  const sortedFormResponses = useMemo(() => {
    return [...formResponses].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [formResponses]);

  const contractStatusColor =
    latestEvent === null
      ? "text-zinc-500"
      : latestEvent.type === "signed"
        ? "text-green"
        : "text-red-700";

  const contractStatus =
    latestEvent === null
      ? "Not signed"
      : latestEvent.type === "signed"
        ? "Signed"
        : "Suspended";
  const handleSuspendContract = useCallback(async () => {
    const confirmed = await confirm({
      title: "Suspend contract?",
      message: `Suspend ${user.name}'s contract and remove them from their current groups?`,
    });
    if (!confirmed) return;

    setIsSuspendPending(true);
    setSuspendMutationError(null);
    try {
      await contractSuspendContractAdmin({ path: { userId: user.id } });
      const refreshed = await userUserDetailAdmin({ path: { id: user.id } });
      if (refreshed.data) {
        setUser(refreshed.data);
      }
      success("Contract suspended", user.name);
    } catch (error) {
      console.error("Failed to suspend contract", error);
      setSuspendMutationError("Failed to suspend contract. Try again.");
    } finally {
      setIsSuspendPending(false);
    }
  }, [confirm, success, user.id, user.name]);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 pb-4 border-b border-zinc-200 mb-4">
        <AvatarProfile pfp={user.profilePicture} size="huge" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-zinc-900">{user.name}</h1>
            <span className={cn("text-sm font-medium", contractStatusColor)}>
              {contractStatus}
            </span>
            {currentAwayRange && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Away
              </span>
            )}
            <Button
              color={ButtonColor.Stone}
              onClick={() => {
                const apiUrl = getApiUrl();
                window.open(`${apiUrl}/auth/impersonate/${user.id}`, "_blank");
              }}
              size="small"
            >
              Log in as user
            </Button>
            <Button
              color={ButtonColor.Red}
              onClick={handleSuspendContract}
              disabled={!user.hasActiveContract || isSuspendPending}
              size="small"
              title={
                user.hasActiveContract
                  ? "Suspend this member's contract"
                  : "This member does not have an active contract"
              }
            >
              {isSuspendPending ? "Suspending..." : "Suspend contract"}
            </Button>
            <Button
              color={ButtonColor.Red}
              onClick={() => setIsDeleteModalOpen(true)}
              size="small"
              title="Delete this member's account: hide it and end its sessions"
            >
              <Trash2 size={14} className="inline mr-1" />
              Delete account
            </Button>
          </div>
          {suspendMutationError && (
            <p className="text-xs text-red-500 mt-2">{suspendMutationError}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-zinc-600 mt-3">
            <span>
              <Mail size={16} className="text-zinc-500 inline mr-1" />
              {user.email}
            </span>
            {user.phoneNumber && (
              <span className="text-zinc-400">
                <Phone size={16} className="text-zinc-500 inline mr-1" />
                {formatPhoneNumberForDisplay(user.phoneNumber)}
              </span>
            )}
            <span className="text-zinc-400">ID: {user.id}</span>
          </div>
          <div className="flex items-center gap-3 mt-3 text-sm">
            <span
              className={
                user.emailNotifsForActions ? "text-green-600" : "text-zinc-400"
              }
            >
              Email {user.emailNotifsForActions ? "on" : "off"}
            </span>
            <span
              className={
                user.textNotifsForActions ? "text-green-600" : "text-zinc-400"
              }
            >
              Text {user.textNotifsForActions ? "on" : "off"}
            </span>
            <span
              className={
                user.pushNotifsForActions ? "text-green-600" : "text-zinc-400"
              }
            >
              Push {user.pushNotifsForActions ? "on" : "off"}
            </span>
            {user.turnedOffAllNotifs && (
              <span className="text-red-500 font-medium">All notifs off</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <UserActionsSection
            userId={user.id}
            actionSummaries={actionSummaries}
            actionRelations={actionRelations}
          />
          <UserNotificationsSection notifs={notifs} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <UserMemberInfoSection user={user} />

          {/* Groups */}
          <MemberGroupMoveSection user={user} onUserUpdated={setUser} />

          {/* Friends */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Friends ({friends.length})
            </h2>
            {friends.length ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {friends.map((friend) => (
                  <FriendRow key={friend.id} friend={friend} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No friends yet.</p>
            )}
          </section>

          <UserRolesSection user={user} onUserUpdated={setUser} />

          <UserTagsSection user={user} loadedTags={loaderData.allTags} />

          {/* Away Periods */}
          <UserAwayPeriodsSection user={user} />

          {/* Contract Details */}
          <section className="border border-zinc-200 rounded p-3">
            <div className="flex items-center justify-between mx-1">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">
                Contract
              </h2>
              <div className="text-sm mb-2">
                <span className={cn("font-medium", contractStatusColor)}>
                  {contractStatus}
                </span>
              </div>
            </div>
            {user.contractEvents && user.contractEvents.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...user.contractEvents]
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((event, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "text-xs flex items-center justify-between px-2 py-1 rounded",
                        event.type === "signed"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700",
                      )}
                    >
                      <span className="font-medium capitalize">
                        {event.type}
                      </span>
                      <span className="text-zinc-500">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No contract events.</p>
            )}
          </section>

          {/* Form Submissions */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Invited Submissions ({sortedFormResponses.length})
            </h2>
            {sortedFormResponses.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sortedFormResponses.map((response) => (
                  <div
                    key={response.id}
                    className="text-xs p-2 rounded bg-zinc-50 border border-zinc-100"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/forms/${response.formId}/responses`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Form #{response.formId}
                      </Link>
                      <span className="text-zinc-400">
                        {new Date(response.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {response.deviceType && (
                      <p className="text-zinc-500 mt-0.5">
                        {response.deviceType}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No form submissions.</p>
            )}
          </section>
        </div>
      </div>
      {isDeleteModalOpen && (
        <DeleteAccountModal
          userId={user.id}
          userName={user.name}
          userEmail={user.email}
          onCancel={() => setIsDeleteModalOpen(false)}
          onDeleted={() => {
            setIsDeleteModalOpen(false);
            success("Account deleted", user.name);
            navigate("/members");
          }}
        />
      )}
    </div>
  );
};

export default UserDetailView;

function FriendRow({ friend }: { friend: ProfileDto }) {
  return (
    <Link
      to={`/member/${friend.id}`}
      className="flex items-center gap-2 rounded px-1 py-1.5 hover:bg-zinc-50"
    >
      <AvatarProfile pfp={friend.profilePicture} size="small" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">
          {friend.displayName}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {formatFriendStatus(friend)}
        </p>
      </div>
    </Link>
  );
}

function formatFriendStatus(friend: ProfileDto) {
  const labels = [];
  if (friend.hasActiveContract) {
    labels.push("Signed");
  } else {
    labels.push("Not signed");
  }
  if (friend.ambassador) {
    labels.push("Ambassador");
  }
  if (friend.isCommunityLeader) {
    labels.push("Leader");
  }
  return labels.join(" · ");
}
