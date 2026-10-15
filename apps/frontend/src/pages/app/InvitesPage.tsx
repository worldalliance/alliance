import { formatInviteMessage } from "@alliance/common/inviteMessage";
import { OnetimeInviteDto } from "@alliance/shared/client";
import { isLedBy } from "@alliance/shared/lib/communityUtils";
import {
  deleteInviteConfirmation,
  inviteBuckets,
} from "@alliance/shared/lib/copy";
import { onetimeInviteSettings } from "@alliance/shared/lib/inviteSettings";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import {
  acceptedInviteCountLabel,
  bucketOnetimeInvitesByActionability,
} from "@alliance/shared/lib/inviteUtils";
import { useAmbassadorInviteDashboard } from "@alliance/shared/lib/useAmbassadorInviteDashboard";
import { useInviteMessageTemplate } from "@alliance/shared/lib/useInviteMessageTemplate";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useOnetimeInvitesOverview } from "@alliance/shared/lib/useOnetimeInvitesOverview";
import { useReusableInvites } from "@alliance/shared/lib/useReusableInvites";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { cn } from "@alliance/shared/styles/util";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { milliseconds } from "date-fns";
import { UserCheck } from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import AmbassadorInviteGoalCard from "../../components/AmbassadorInviteGoalCard";
import ExpandableList from "../../components/ExpandableList";
import InviteForm from "../../components/InviteForm";
import InviteSettingsModal, {
  type InviteSettingsTarget,
} from "../../components/InviteSettingsModal";
import InviteShareLink from "../../components/InviteShareLink";
import OnetimeInviteListItem from "../../components/OnetimeInviteListItem";
import { useAuth } from "../../lib/AuthContext";
import { useCopyInviteLink } from "../../lib/useCopyInviteLink";

enum InviteListTab {
  Individual = "individual",
  Group = "group",
}

const INVITE_LIST_TABS = [
  InviteListTab.Individual,
  InviteListTab.Group,
] as const;

const INVITE_LIST_TAB_LABELS: Record<InviteListTab, string> = {
  [InviteListTab.Individual]: "Individual invites",
  [InviteListTab.Group]: "Group invites",
};

const InvitesPage = () => {
  const { user } = useAuth();
  const { error: errorToast, confirm } = useToast();
  const { data: inviteMessageTemplate } = useInviteMessageTemplate({
    enabled: Boolean(user),
  });
  const {
    invites,
    isLoading: loadingInvites,
    isError,
    upsertInvite,
    approveInvite,
    rejectInvite,
    updateInvite,
    deleteInvite,
  } = useOnetimeInvitesOverview({ enabled: Boolean(user) });
  const { communities } = useMyCommunities({});
  const {
    links: reusableInviteLinks,
    isPending: loadingReusableInvites,
    isError: reusableInvitesError,
  } = useReusableInvites({
    enabled: Boolean(user),
  });
  const [settingsInviteId, setSettingsInviteId] = useState<number | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);
  const [messageCopiedInviteId, setMessageCopiedInviteId] = useState<
    number | null
  >(null);
  const [inviteListTab, setInviteListTab] = useState(InviteListTab.Individual);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { refetch: refetchAmbassadorDashboard } = useAmbassadorInviteDashboard({
    enabled: Boolean(user?.ambassador),
  });

  const leaderCommunityIds = useMemo(
    () => getLeaderCommunityIds(user ?? undefined),
    [user],
  );

  const { actionable, unverifiableActionable, waitingForResponse, settled } =
    useMemo(
      () =>
        bucketOnetimeInvitesByActionability({
          invites,
          leaderCommunityIds,
          userId: user?.id,
        }),
      [invites, leaderCommunityIds, user?.id],
    );

  const acceptedCount = acceptedInviteCountLabel({
    onetimeInvites: invites,
    onetimeInvitesError: isError,
    reusableLinks: reusableInviteLinks,
    reusableLinksPending: loadingReusableInvites,
    reusableLinksError: reusableInvitesError,
  });
  const hasSingleUseInvites =
    actionable.length > 0 ||
    unverifiableActionable.length > 0 ||
    waitingForResponse.length > 0 ||
    settled.length > 0;
  const hasGroupInvites = reusableInviteLinks.length > 0;
  const showInviteTypeTabs = hasSingleUseInvites && hasGroupInvites;
  const showingIndividualInvites = showInviteTypeTabs
    ? inviteListTab === InviteListTab.Individual
    : hasSingleUseInvites || (isError && !hasGroupInvites);
  const showingGroupInvites = showInviteTypeTabs
    ? inviteListTab === InviteListTab.Group
    : hasGroupInvites;

  const copyInviteLink = useCopyInviteLink();

  const copyMessageToClipboard = useCallback(
    async (code: string) => {
      if (!inviteMessageTemplate) {
        errorToast("The invitation message is not available yet.");
        return false;
      }
      const inviteLink = getOnetimeInviteSignupUrl(getInviteBaseUrl(), code);
      const copied = await copyToClipboard(
        formatInviteMessage(inviteMessageTemplate, inviteLink),
      );
      if (!copied) {
        errorToast("Could not copy the invitation message.");
      }
      return copied;
    },
    [errorToast, inviteMessageTemplate],
  );

  const handleCopied = useCallback((inviteId: number) => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    setCopiedInviteId(inviteId);
    setMessageCopiedInviteId(null);
    copiedTimeoutRef.current = setTimeout(
      () => {
        setCopiedInviteId(null);
        copiedTimeoutRef.current = null;
      },
      milliseconds({ seconds: 2 }),
    );
  }, []);

  const handleMessageCopied = useCallback((inviteId: number) => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    setCopiedInviteId(null);
    setMessageCopiedInviteId(inviteId);
    copiedTimeoutRef.current = setTimeout(
      () => {
        setMessageCopiedInviteId(null);
        copiedTimeoutRef.current = null;
      },
      milliseconds({ seconds: 2 }),
    );
  }, []);

  const handleApproveInvite = useCallback(
    (inviteId: number) => {
      void approveInvite(inviteId).catch((err: Error) => {
        errorToast(`Failed to approve invite: ${err.message}`);
      });
    },
    [approveInvite, errorToast],
  );

  const handleRejectInvite = useCallback(
    (inviteId: number) => {
      void rejectInvite(inviteId).catch((err: Error) => {
        errorToast(`Failed to reject invite: ${err.message}`);
      });
    },
    [rejectInvite, errorToast],
  );

  const handleDeleteInvite = useCallback(
    (inviteId: number, event: MouseEvent<HTMLElement>) => {
      void (async () => {
        const ok = await confirm({
          message: deleteInviteConfirmation.message,
          confirmLabel: deleteInviteConfirmation.confirmLabel,
          cancelLabel: deleteInviteConfirmation.cancelLabel,
          anchorEl: event.currentTarget,
          placement: ToastPlacement.TopLeft,
        });
        if (!ok) {
          return;
        }

        await deleteInvite(inviteId).catch(() => {});
      })();
    },
    [confirm, deleteInvite],
  );

  const leaderCommunities = useMemo(
    () =>
      user
        ? communities.filter((community) => isLedBy(community, user.id))
        : [],
    [communities, user],
  );

  const settingsInvite =
    invites.find((invite) => invite.id === settingsInviteId) ?? null;
  const settings =
    settingsInvite &&
    onetimeInviteSettings({
      invite: settingsInvite,
      baseUrl: getInviteBaseUrl(),
      updateInvite,
    });
  const settingsTarget: InviteSettingsTarget | null = settingsInvite &&
    settings && {
      ...settings,
      delete: {
        ...settings.delete,
        confirmMessage: deleteInviteConfirmation.message,
      },
      onDelete: () => deleteInvite(settingsInvite.id),
    };

  const handleDeleteRequest = useCallback(
    (inviteId: number) => {
      void deleteInvite(inviteId).catch(() => {});
    },
    [deleteInvite],
  );

  const handleInviteCreated = useCallback(
    (invite: OnetimeInviteDto) => {
      upsertInvite(invite);
      setInviteListTab(InviteListTab.Individual);
      if (user?.ambassador) {
        void refetchAmbassadorDashboard();
      }
    },
    [refetchAmbassadorDashboard, upsertInvite, user?.ambassador],
  );

  const handleReusableInviteCreated = useCallback(() => {
    setInviteListTab(InviteListTab.Group);
  }, []);

  if (!user || loadingInvites) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--navbar-top-bar-height))] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <CenterLayout>
      <div
        className={
          user.ambassador ? "flex flex-col gap-y-8" : "flex flex-col gap-y-2"
        }
      >
        {user.ambassador ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-title">Invites</h1>
            <div className="flex flex-row items-center gap-x-2 bg-white rounded px-4 py-3 shrink-0 sm:min-w-52">
              <UserCheck className="w-10 h-10 bg-green/10 rounded p-2 text-green" />
              <div>
                <p className="font-semibold text-black text-lg sm:text-xl">
                  {acceptedCount}
                </p>
                <p className="leading-none text-zinc-500 text-sm sm:text-base">
                  Your accepted invites
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-x-6">
                <h1 className="text-title">Invites</h1>
                <div className="flex flex-row items-center gap-x-2 bg-white rounded p-4 shrink-0">
                  <UserCheck className="w-10 h-10 bg-green/10 rounded p-2 text-green" />
                  <div>
                    <p className="font-semibold text-black text-lg sm:text-xl">
                      {acceptedCount}
                    </p>
                    <p className="leading-none text-zinc-500 text-sm sm:text-base">
                      Accepted invites
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {user.ambassador && <AmbassadorInviteGoalCard />}

        <div className="flex flex-col gap-y-6">
          <InviteForm
            onInviteCreated={handleInviteCreated}
            onReusableInviteCreated={handleReusableInviteCreated}
          />
        </div>

        {(showInviteTypeTabs ||
          showingIndividualInvites ||
          showingGroupInvites) && (
          <div className="flex flex-col gap-y-6 pt-5">
            {showInviteTypeTabs && (
              <div className="flex flex-row gap-x-2 justify-start">
                {INVITE_LIST_TABS.map((tab) => (
                  <Button
                    color={ButtonColor.Transparent}
                    key={tab}
                    onClick={() => setInviteListTab(tab)}
                    aria-pressed={inviteListTab === tab}
                    className={cn(
                      "!border-b-[2px] rounded-none",
                      inviteListTab === tab
                        ? "border-b-green! text-black"
                        : "border-b-transparent! hover:border-b-zinc-200! text-zinc-500",
                    )}
                  >
                    <p className="text-base">{INVITE_LIST_TAB_LABELS[tab]}</p>
                  </Button>
                ))}
              </div>
            )}
            {showingIndividualInvites && (
              <div className="flex flex-col gap-y-12">
                {isError && (
                  <p className="text-red-500 text-sm">Failed to load invites</p>
                )}

                {actionable.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <p className="font-semibold text-2xl">
                      {inviteBuckets.actionable.title}
                    </p>
                    <ExpandableList>
                      {actionable.map((request) => (
                        <OnetimeInviteListItem
                          key={request.id}
                          invite={request}
                          showCommunityLabel={true}
                          communityLabel={request.community?.name}
                          selfInvited={user.id === request.invitingUser?.id}
                          onApprove={handleApproveInvite}
                          onReject={handleRejectInvite}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}

                {unverifiableActionable.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-1">
                      <p className="font-semibold text-2xl">
                        {inviteBuckets.unverifiableActionable.title}
                      </p>
                      <p className="text-zinc-500">
                        {inviteBuckets.unverifiableActionable.description}
                      </p>
                    </div>
                    <ExpandableList>
                      {unverifiableActionable.map((invite) => (
                        <OnetimeInviteListItem
                          key={invite.id}
                          invite={invite}
                          showCommunityLabel={true}
                          communityLabel={invite.community?.name}
                          selfInvited={user.id === invite.invitingUser?.id}
                          copied={copiedInviteId === invite.id}
                          messageCopied={messageCopiedInviteId === invite.id}
                          onDelete={handleDeleteInvite}
                          onOpenSettings={
                            user.id === invite.invitingUser?.id
                              ? setSettingsInviteId
                              : undefined
                          }
                          onCopy={copyInviteLink}
                          onCopyMessage={copyMessageToClipboard}
                          onCopied={handleCopied}
                          onMessageCopied={handleMessageCopied}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}

                {waitingForResponse.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-1">
                      <p className="font-semibold text-2xl">
                        {inviteBuckets.waitingForResponse.title}
                      </p>
                      <p className="text-zinc-500">
                        {inviteBuckets.waitingForResponse.description}
                      </p>
                    </div>
                    <ExpandableList>
                      {waitingForResponse.map((request) => (
                        <OnetimeInviteListItem
                          key={request.id}
                          invite={request}
                          showCommunityLabel={true}
                          communityLabel={request.community?.name}
                          selfInvited={user.id === request.invitingUser?.id}
                          onDelete={(inviteId) => handleDeleteRequest(inviteId)}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}

                {settled.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-1">
                      <p className="font-semibold text-2xl">
                        {inviteBuckets.settled.title}
                      </p>
                      <p className="text-zinc-500">
                        {inviteBuckets.settled.description}
                      </p>
                    </div>
                    <ExpandableList>
                      {settled.map((invite) => (
                        <OnetimeInviteListItem
                          key={invite.id}
                          invite={invite}
                          showCommunityLabel={true}
                          communityLabel={invite.community?.name}
                          selfInvited={user.id === invite.invitingUser?.id}
                          copied={copiedInviteId === invite.id}
                          messageCopied={messageCopiedInviteId === invite.id}
                          onDelete={handleDeleteInvite}
                          onCopy={copyInviteLink}
                          onCopyMessage={copyMessageToClipboard}
                          onCopied={handleCopied}
                          onMessageCopied={handleMessageCopied}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}
              </div>
            )}
            {showingGroupInvites && <InviteShareLink />}
          </div>
        )}
        {settingsTarget && (
          <InviteSettingsModal
            target={settingsTarget}
            leaderCommunities={leaderCommunities}
            onClose={() => setSettingsInviteId(null)}
          />
        )}
      </div>
    </CenterLayout>
  );
};

export default InvitesPage;
