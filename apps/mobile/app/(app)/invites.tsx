import { isLedBy } from "@alliance/shared/lib/communityUtils";
import {
  deleteInviteConfirmation,
  inviteBuckets,
} from "@alliance/shared/lib/copy";
import {
  onetimeInviteSettings,
  type InviteSettingsTarget,
} from "@alliance/shared/lib/inviteSettings";
import { bucketOnetimeInvitesByActionability } from "@alliance/shared/lib/inviteUtils";
import { useAmbassadorInviteDashboard } from "@alliance/shared/lib/useAmbassadorInviteDashboard";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useOnetimeInvitesOverview } from "@alliance/shared/lib/useOnetimeInvitesOverview";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { milliseconds } from "date-fns";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, View } from "react-native";
import AmbassadorInviteGoalCard from "../../components/AmbassadorInviteGoalCard";
import InviteForm from "../../components/InviteForm";
import { InviteSection } from "../../components/InviteSection";
import InviteSettingsModal from "../../components/InviteSettingsModal";
import InviteShareLink from "../../components/InviteShareLink";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import ReferralQrSection from "../../components/ReferralQrSection";
import { ScreenWithLoading } from "../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../components/system/SegmentedTabs";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { getSiteUrl } from "../../lib/config";
import { colors } from "../../lib/style/colors";
import { useReferralLink } from "../../lib/useReferralLink";

enum InvitesTab {
  ReferralQr = "referral_qr",
  New = "new",
  Reusable = "reusable",
  Past = "past",
}

const INVITES_TAB_LABELS: Record<InvitesTab, string> = {
  [InvitesTab.ReferralQr]: "QR code",
  [InvitesTab.New]: "Individual",
  [InvitesTab.Reusable]: "Multiple",
  [InvitesTab.Past]: "Past",
};

const INVITES_TABS_ORDER: InvitesTab[] = [
  InvitesTab.ReferralQr,
  InvitesTab.New,
  InvitesTab.Reusable,
  InvitesTab.Past,
];

const INVITES_EMPTY_MESSAGE = "Your invites will appear here.";

export default function InvitesScreen() {
  const { user } = useAuth();
  const {
    invites,
    isLoading: loadingInvites,
    isError,
    refetch,
    approveInvite,
    rejectInvite,
    updateInvite,
    deleteInvite,
  } = useOnetimeInvitesOverview({ enabled: Boolean(user) });
  const { communities } = useMyCommunities({});
  const [refreshing, setRefreshing] = useState(false);
  const [sharedInviteId, setSharedInviteId] = useState<number | null>(null);
  const [settingsInviteId, setSettingsInviteId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<InvitesTab>(
    InvitesTab.ReferralQr,
  );
  const sharedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { refetch: refetchAmbassadorDashboard } = useAmbassadorInviteDashboard({
    enabled: Boolean(user?.ambassador),
  });

  const referralLink = useReferralLink(user);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      refetch(),
      user?.ambassador ? refetchAmbassadorDashboard() : Promise.resolve(),
    ]).finally(() => setRefreshing(false));
  }, [refetch, refetchAmbassadorDashboard, user?.ambassador]);

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

  const handleShared = useCallback((inviteId: number) => {
    if (sharedTimeoutRef.current) {
      clearTimeout(sharedTimeoutRef.current);
    }
    setSharedInviteId(inviteId);
    sharedTimeoutRef.current = setTimeout(
      () => {
        setSharedInviteId(null);
        sharedTimeoutRef.current = null;
      },
      milliseconds({ seconds: 2 }),
    );
  }, []);

  const handleApproveInvite = useCallback(
    (inviteId: number) => {
      void approveInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to approve invite");
      });
    },
    [approveInvite],
  );

  const handleRejectInvite = useCallback(
    (inviteId: number) => {
      void rejectInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to reject invite");
      });
    },
    [rejectInvite],
  );

  const handleDeleteInvite = useCallback(
    (inviteId: number, _event: unknown) => {
      void deleteInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to delete invite");
      });
    },
    [deleteInvite],
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
  const settingsTarget: InviteSettingsTarget | null = settingsInvite && {
    ...onetimeInviteSettings({
      invite: settingsInvite,
      baseUrl: getSiteUrl(),
      updateInvite,
    }),
    onDelete: async () => {
      setSettingsInviteId(null);
      Alert.alert(deleteInviteConfirmation.message, undefined, [
        { text: deleteInviteConfirmation.cancelLabel, style: "cancel" },
        {
          text: deleteInviteConfirmation.confirmLabel,
          style: "destructive",
          onPress: () => handleDeleteInvite(settingsInvite.id, null),
        },
      ]);
    },
  };

  const handleInviteCreated = useCallback(() => {
    if (user?.ambassador) {
      void refetchAmbassadorDashboard();
    }
  }, [refetchAmbassadorDashboard, user?.ambassador]);

  const isEmptyPast =
    actionable.length === 0 &&
    unverifiableActionable.length === 0 &&
    waitingForResponse.length === 0 &&
    settled.length === 0;

  if (!user || loadingInvites) {
    return <ScreenWithLoading title="Invites" loading />;
  }

  const tabContent: Record<InvitesTab, React.ReactNode> = {
    [InvitesTab.ReferralQr]: <ReferralQrSection referralLink={referralLink} />,
    [InvitesTab.New]: (
      <>
        {isError && (
          <Text className="text-sm text-red-500">Failed to load invites</Text>
        )}
        <View className="pt-2">
          <InviteSection
            title={inviteBuckets.unverifiableActionable.title}
            description={inviteBuckets.unverifiableActionable.description}
            invites={unverifiableActionable}
            user={user}
            sharedInviteId={sharedInviteId}
            actions={{
              onDeleteWithConfirm: handleDeleteInvite,
              onOpenSettings: setSettingsInviteId,
              onShared: handleShared,
            }}
          />
        </View>
      </>
    ),
    [InvitesTab.Reusable]: <InviteShareLink />,
    [InvitesTab.Past]: (
      <>
        {isError && (
          <Text className="text-sm text-red-500">Failed to load invites</Text>
        )}
        {isEmptyPast && (
          <Text className="text-center text-zinc-500 py-8">
            {INVITES_EMPTY_MESSAGE}
          </Text>
        )}
        <InviteSection
          title={inviteBuckets.actionable.title}
          invites={actionable}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{
            onApprove: handleApproveInvite,
            onReject: handleRejectInvite,
            onShared: handleShared,
          }}
        />
        <InviteSection
          title={inviteBuckets.unverifiableActionable.title}
          description={inviteBuckets.unverifiableActionable.description}
          invites={unverifiableActionable}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{
            onDeleteWithConfirm: handleDeleteInvite,
            onOpenSettings: setSettingsInviteId,
            onShared: handleShared,
          }}
        />
        <InviteSection
          title={inviteBuckets.waitingForResponse.title}
          description={inviteBuckets.waitingForResponse.description}
          invites={waitingForResponse}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{
            onDelete: handleDeleteInvite,
            onShared: handleShared,
          }}
        />
        <InviteSection
          title={inviteBuckets.settled.title}
          description={inviteBuckets.settled.description}
          invites={settled}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{ onShared: handleShared }}
        />
      </>
    ),
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.grey[0] }}>
      <SimplePageTitle title="Invites" />
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-4 gap-4">
          {user.ambassador && <AmbassadorInviteGoalCard />}
          <SegmentedTabs
            tabs={INVITES_TABS_ORDER}
            selectedTab={selectedTab}
            onSelect={setSelectedTab}
            labels={INVITES_TAB_LABELS}
          />
          {selectedTab === InvitesTab.New && (
            <InviteForm onInviteCreated={handleInviteCreated} />
          )}
          {tabContent[selectedTab]}
        </View>
      </KeyboardAwareScrollView>

      <InviteSettingsModal
        target={settingsTarget}
        leaderCommunities={leaderCommunities}
        onClose={() => setSettingsInviteId(null)}
      />
    </View>
  );
}
