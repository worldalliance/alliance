import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import type { OnetimeInviteDto } from "@alliance/shared/client";
import {
  userApproveOnetimeInvite,
  userDeleteOnetimeInvite,
  userGetOnetimeInvitesOverview,
  userRejectOnetimeInvite,
} from "@alliance/shared/client";
import { bucketOnetimeInvitesByActionability } from "@alliance/shared/lib/inviteUtils";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { inviteBuckets } from "@alliance/shared/lib/copy";
import { runAsync } from "@alliance/shared/lib/utils";
import { useAuth } from "../../lib/AuthContext";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import { SegmentedTabs } from "../../components/system/SegmentedTabs";
import { ScreenWithLoading } from "../../components/system/ScreenWithLoading";
import Text from "../../components/system/Text";
import InviteForm from "../../components/InviteForm";
import { InviteSection } from "../../components/InviteSection";
import { colors } from "../../lib/style/colors";

enum InvitesTab {
  New = "new",
  Past = "past",
}

const INVITES_TAB_LABELS: Record<InvitesTab, string> = {
  [InvitesTab.New]: "New",
  [InvitesTab.Past]: "Past",
};

const INVITES_TABS_ORDER: InvitesTab[] = [InvitesTab.New, InvitesTab.Past];

export default function InvitesScreen() {
  const { user } = useAuth();
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);
  const [sharedInviteId, setSharedInviteId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<InvitesTab>(InvitesTab.New);
  const sharedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInvites = useCallback(async () => {
    const response = await userGetOnetimeInvitesOverview();
    if (response.data) {
      setInvites(response.data);
      setError(null);
    } else {
      setError("Failed to load invites");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingInvites(true);
    loadInvites().finally(() => {
      if (!cancelled) setLoadingInvites(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadInvites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInvites().finally(() => setRefreshing(false));
  }, [loadInvites]);

  const leaderCommunityIds = useMemo(
    () => getLeaderCommunityIds(user ?? undefined),
    [user],
  );

  const { actionable, unverifiableActionable, waitingForResponse, settled } =
    useMemo(() => {
      if (!user) {
        return {
          actionable: [],
          unverifiableActionable: [],
          waitingForResponse: [],
          settled: [],
        };
      }
      return bucketOnetimeInvitesByActionability({
        invites,
        leaderCommunityIds,
        userId: user.id,
      });
    }, [invites, leaderCommunityIds, user]);

  const acceptedInvites = useMemo(
    () => invites.filter((invite) => invite.status === "link_used"),
    [invites],
  );

  const handleShared = useCallback((inviteId: number) => {
    if (sharedTimeoutRef.current) {
      clearTimeout(sharedTimeoutRef.current);
    }
    setSharedInviteId(inviteId);
    sharedTimeoutRef.current = setTimeout(() => {
      setSharedInviteId(null);
      sharedTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleApproveInvite = useCallback((inviteId: number) => {
    runAsync(async () => {
      const response = await userApproveOnetimeInvite({ path: { inviteId } });
      if (response.data) {
        setInvites((prev) =>
          prev.map((invite) =>
            invite.id === inviteId ? response.data! : invite,
          ),
        );
      }
    });
  }, []);

  const handleRejectInvite = useCallback((inviteId: number) => {
    runAsync(async () => {
      const response = await userRejectOnetimeInvite({ path: { inviteId } });
      if (!response.error) {
        setInvites((prev) => prev.filter((request) => request.id !== inviteId));
      }
    });
  }, []);

  const handleDeleteInvite = useCallback(
    (inviteId: number, _event: unknown) => {
      runAsync(async () => {
        const response = await userDeleteOnetimeInvite({ path: { inviteId } });
        if (!response.error) {
          setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
        }
      });
    },
    [],
  );

  const handleInviteCreated = useCallback((invite: OnetimeInviteDto) => {
    setInvites((prev) => [invite, ...prev]);
  }, []);

  const isEmptyPast =
    actionable.length === 0 &&
    unverifiableActionable.length === 0 &&
    waitingForResponse.length === 0 &&
    settled.length === 0;

  if (!user || loadingInvites) {
    return <ScreenWithLoading title="Invites" loading />;
  }

  const renderTabContent = () => {
    const emptyMessage = "Your invites will appear here.";

    return (
      <View className="px-4 pt-4 gap-4">
        {selectedTab === InvitesTab.New && (
          <>
            <InviteForm onInviteCreated={handleInviteCreated} />
            {error !== null && (
              <Text className="text-sm text-red-500">{error}</Text>
            )}
            <InviteSection
              title={inviteBuckets.unverifiableActionable.title}
              description={inviteBuckets.unverifiableActionable.description}
              invites={unverifiableActionable}
              user={user}
              sharedInviteId={sharedInviteId}
              actions={{
                onDeleteWithConfirm: handleDeleteInvite,
                onShared: handleShared,
              }}
            />
          </>
        )}
        {selectedTab === InvitesTab.Past && (
          <>
            {error !== null && (
              <Text className="text-sm text-red-500">{error}</Text>
            )}
            {isEmptyPast && (
              <Text className="text-center text-zinc-500 py-8">
                {emptyMessage}
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
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-zinc-50">
      <SimplePageTitle title="Invites">
        {acceptedInvites.length > 0 && (
          <Text className="text-sm text-zinc-500 py-4">
            Accepted: {acceptedInvites.length}
          </Text>
        )}
      </SimplePageTitle>
      <View className="px-4 pt-3 pb-2">
        <SegmentedTabs
          tabs={INVITES_TABS_ORDER}
          selectedTab={selectedTab}
          onSelect={setSelectedTab}
          labels={INVITES_TAB_LABELS}
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.green}
          />
        }
      >
        {renderTabContent()}
      </ScrollView>
    </View>
  );
}
