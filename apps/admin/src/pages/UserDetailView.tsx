import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { userFriendsQuery } from "@alliance/shared/lib/user";
import { cn } from "@alliance/shared/styles/util";
import { prefetchFromLoader } from "@alliance/sharedweb/lib/queryClient";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Mail, Phone, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { Route } from "../../.react-router/types/src/pages/+types/UserDetailView";
import DeleteAccountModal from "../components/DeleteAccountModal";
import MemberGroupMoveSection from "../components/MemberGroupMoveSection";
import UserAwayPeriodsSection from "../components/UserAwayPeriodsSection";
import UserActionsSection from "../components/user-detail/UserActionsSection";
import UserFormSubmissionsSection from "../components/user-detail/UserFormSubmissionsSection";
import UserFriendsSection from "../components/user-detail/UserFriendsSection";
import UserMemberInfoSection from "../components/user-detail/UserMemberInfoSection";
import UserNotificationSettingsSection from "../components/user-detail/UserNotificationSettingsSection";
import UserNotificationsSection from "../components/user-detail/UserNotificationsSection";
import UserRolesSection from "../components/user-detail/UserRolesSection";
import UserTagsSection from "../components/user-detail/UserTagsSection";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { getApiUrl } from "../lib/config";
import { tagSummariesQuery } from "../lib/useTagsAdmin";
import { userActionRelationsQuery } from "../lib/useUserActionRelationsAdmin";
import { useUserAwayRangesAdmin } from "../lib/useUserAwayRangesAdmin";
import { useUserDetailAdmin, userDetailQuery } from "../lib/useUserDetailAdmin";
import {
  useUserNotifsAndFormsAdmin,
  userFormResponsesQuery,
  userNotifsQuery,
} from "../lib/useUserNotifsAndFormsAdmin";

export function clientLoader({ params }: Route.LoaderArgs) {
  const userIdParam = params.userId;
  if (!userIdParam) {
    throw new Error("Not found");
  }
  const userId = Number.parseInt(userIdParam, 10);
  if (Number.isNaN(userId)) {
    throw new Error("Not found");
  }

  prefetchFromLoader(userDetailQuery(userId));
  prefetchFromLoader(userActionRelationsQuery(userId));
  prefetchFromLoader(tagSummariesQuery());
  prefetchFromLoader(userFriendsQuery(userId));
  prefetchFromLoader(userNotifsQuery(userId));
  prefetchFromLoader(userFormResponsesQuery(userId));

  return { userId };
}

const UserDetailView: React.FC = () => {
  const userDetail = useUserDetailAdmin(
    useLoaderData<typeof clientLoader>().userId,
  );
  const { data: user, isError, error } = userDetail.query;
  // A member deleted since they were cached refetches as a 404 over the
  // cached copy.
  const notFound = thrownStatus(error) === 404;
  if (user && !notFound) {
    return <UserDetail user={user} userDetail={userDetail} />;
  }
  return (
    <div className="p-4">
      {isError ? (
        <p className="text-red-500">
          {notFound ? "Member not found" : "Failed to load member"}
        </p>
      ) : (
        "Loading member..."
      )}
    </div>
  );
};

const UserDetail = ({
  user,
  userDetail: {
    query: { isRefetchError },
    refresh,
    updateRoles: { mutateAsync: updateRoles },
    suspendContract: { mutateAsync: suspendContract },
    setTagMembership: { mutateAsync: setTagMembership },
    deleteAccount: { mutateAsync: deleteAccount },
  },
}: {
  user: UserAdminDetailDto;
  userDetail: ReturnType<typeof useUserDetailAdmin>;
}) => {
  const { notifs, formResponses } = useUserNotifsAndFormsAdmin(user.id);

  const [isSuspendPending, setIsSuspendPending] = useState(false);
  const [suspendMutationError, setSuspendMutationError] = useState<
    string | null
  >(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { confirm, success } = useToast();

  const navigate = useNavigate();

  const { currentAwayRange } = useUserAwayRangesAdmin(user.id);

  const latestEvent = user.lastContractEvent ?? null;

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
      await suspendContract();
      success("Contract suspended", user.name);
    } catch (error) {
      console.error("Failed to suspend contract", error);
      setSuspendMutationError(
        adminRefusalMessage(error, "Failed to suspend contract. Try again."),
      );
    } finally {
      setIsSuspendPending(false);
    }
  }, [confirm, success, suspendContract, user.name]);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {isRefetchError && (
        <p className="text-xs text-red-500 mb-2">
          Could not refresh this member. Reload to see their latest details.
        </p>
      )}
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <UserActionsSection userId={user.id} />
          <UserNotificationsSection query={notifs} />
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <UserMemberInfoSection user={user} />

          <UserNotificationSettingsSection userId={user.id} />

          {/* Groups */}
          <MemberGroupMoveSection user={user} refreshUser={refresh} />

          <UserFriendsSection userId={user.id} />

          <UserRolesSection user={user} updateRoles={updateRoles} />

          <UserTagsSection user={user} setTagMembership={setTagMembership} />

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

          <UserFormSubmissionsSection query={formResponses} />
        </div>
      </div>
      {isDeleteModalOpen && (
        <DeleteAccountModal
          deleteAccount={deleteAccount}
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
