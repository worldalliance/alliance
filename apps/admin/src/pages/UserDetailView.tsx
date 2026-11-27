import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import {
  CONTRACT_STATUS_LABEL,
  contractStatus,
} from "@alliance/shared/lib/contract";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { userFriendsQuery } from "@alliance/shared/lib/user";
import { prefetchFromLoader } from "@alliance/sharedweb/lib/queryClient";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { type ReactNode, useCallback, useState } from "react";
import { href, useLoaderData, useNavigate } from "react-router";
import { Route } from "../../.react-router/types/src/pages/+types/UserDetailView";
import DeleteAccountModal from "../components/DeleteAccountModal";
import MemberGroupMoveSection from "../components/MemberGroupMoveSection";
import { secondaryButtonClass } from "../components/ui/controlStyles";
import PageShell from "../components/ui/PageShell";
import StatusPill from "../components/ui/StatusPill";
import Tabs from "../components/ui/Tabs";
import MemberTextsSection from "../components/user-detail/MemberTextsSection";
import {
  MEMBER_VIEWS,
  MEMBER_VIEW_ITEMS,
  MemberView,
} from "../components/user-detail/memberView";
import { SectionRefreshError } from "../components/user-detail/SectionQueryState";
import UserActionsSection from "../components/user-detail/UserActionsSection";
import UserContractSection from "../components/user-detail/UserContractSection";
import UserFormSubmissionsSection from "../components/user-detail/UserFormSubmissionsSection";
import UserFriendsSection from "../components/user-detail/UserFriendsSection";
import UserMemberInfoSection from "../components/user-detail/UserMemberInfoSection";
import UserNotificationSettingsSection from "../components/user-detail/UserNotificationSettingsSection";
import UserNotificationsSection from "../components/user-detail/UserNotificationsSection";
import UserRolesSection from "../components/user-detail/UserRolesSection";
import UserTagsSection from "../components/user-detail/UserTagsSection";
import UserAwayPeriodsSection from "../components/UserAwayPeriodsSection";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { getApiUrl } from "../lib/config";
import { CONTRACT_STATUS_TONE } from "../lib/contractStatusStyle";
import { StatusTone } from "../lib/statusTone";
import { useSearchParamTab } from "../lib/useSearchParamTab";
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

const BACK = { to: href("/members"), label: "Members" };

const MemberLoadState = ({ children }: { children: ReactNode }) => (
  <PageShell title="Member" back={BACK}>
    {children}
  </PageShell>
);

const LOADING = (
  <MemberLoadState>
    <p role="status" className="text-sm text-zinc-600">
      Loading member…
    </p>
  </MemberLoadState>
);

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
  if (!isError) return LOADING;
  return (
    <MemberLoadState>
      <p role="alert" className="text-sm text-red-600">
        {notFound
          ? "Member not found"
          : "Failed to load member. Reload to try again."}
      </p>
    </MemberLoadState>
  );
};

const MemberPills = ({
  user,
  away,
}: {
  user: UserAdminDetailDto;
  away: boolean;
}) => {
  const contract = contractStatus(user.lastContractEvent);
  const roles = [
    user.admin && "Admin",
    user.staff && "Staff",
    user.ambassador && "Ambassador",
  ].filter((role) => role !== false);
  return (
    <ul aria-label="Status and roles" className="flex flex-wrap gap-1">
      <li className="flex">
        <StatusPill
          tone={CONTRACT_STATUS_TONE[contract]}
          label={CONTRACT_STATUS_LABEL[contract]}
        />
      </li>
      {away && (
        <li className="flex">
          <StatusPill tone={StatusTone.Attention} label="Away" />
        </li>
      )}
      {roles.map((role) => (
        <li key={role} className="flex">
          <StatusPill tone={StatusTone.Neutral} label={role} />
        </li>
      ))}
    </ul>
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
  const [view, , viewHref] = useSearchParamTab(
    MEMBER_VIEWS,
    MemberView.Profile,
    {
      param: "view",
    },
  );
  const { notifs, formResponses } = useUserNotifsAndFormsAdmin(user.id);

  const [isSuspendPending, setIsSuspendPending] = useState(false);
  const [suspendMutationError, setSuspendMutationError] = useState<
    string | null
  >(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { confirm, success } = useToast();

  const navigate = useNavigate();

  const { currentAwayRange } = useUserAwayRangesAdmin(user.id);

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

  const viewBodies: Record<MemberView, ReactNode> = {
    [MemberView.Profile]: (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <UserMemberInfoSection user={user} />
          <UserNotificationSettingsSection userId={user.id} />
        </div>
        <div className="flex flex-col gap-4">
          <UserRolesSection user={user} updateRoles={updateRoles} />
          <UserTagsSection user={user} setTagMembership={setTagMembership} />
          <UserContractSection user={user} />
          <UserAwayPeriodsSection user={user} />
        </div>
      </div>
    ),
    [MemberView.Activity]: (
      <div className="flex flex-col gap-4">
        <UserActionsSection userId={user.id} />
        <UserNotificationsSection query={notifs} />
        <UserFormSubmissionsSection query={formResponses} />
      </div>
    ),
    [MemberView.Messages]: <MemberTextsSection member={user} />,
    [MemberView.Connections]: (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <MemberGroupMoveSection user={user} refreshUser={refresh} />
        <UserFriendsSection userId={user.id} />
      </div>
    ),
  };

  return (
    <PageShell
      title={user.name}
      back={BACK}
      meta={<MemberPills user={user} away={Boolean(currentAwayRange)} />}
      description={
        <>
          {user.email}
          {user.phoneNumber &&
            ` · ${formatPhoneNumberForDisplay(user.phoneNumber)}`}
          {` · ID ${user.id}`}
        </>
      }
      actions={
        <a
          href={`${getApiUrl()}/auth/impersonate/${user.id}`}
          target="_blank"
          rel="noreferrer"
          className={secondaryButtonClass}
        >
          Log in as member
        </a>
      }
      menu={[
        {
          label: isSuspendPending ? "Suspending contract…" : "Suspend contract",
          onSelect: () => void handleSuspendContract(),
          destructive: true,
          disabledReason: !user.hasActiveContract
            ? "This member has no active contract."
            : isSuspendPending
              ? "Suspension in progress."
              : undefined,
        },
        {
          label: "Delete account",
          onSelect: () => setIsDeleteModalOpen(true),
          destructive: true,
        },
      ]}
    >
      <div className="flex flex-col gap-4">
        <div>
          <SectionRefreshError noun="this member" isError={isRefetchError} />
          {suspendMutationError && (
            <p role="alert" className="mb-2 text-sm text-red-600">
              {suspendMutationError}
            </p>
          )}
          <Tabs
            label="Member views"
            items={MEMBER_VIEW_ITEMS}
            current={view}
            href={viewHref}
          />
        </div>
        {/* Every view stays mounted so a draft reply or unsaved form survives a view switch. */}
        {MEMBER_VIEWS.map((each) => (
          <div key={each} hidden={each !== view}>
            {viewBodies[each]}
          </div>
        ))}
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
            navigate(href("/members"));
          }}
        />
      )}
    </PageShell>
  );
};

export default UserDetailView;
