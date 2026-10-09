import { R } from "@alliance/common/result";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useLocalSearchParams, useNavigation } from "expo-router";
import type {
  NavigationProp,
  ParamListBase,
} from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  GROUPS_LINK_ALERTS,
  type GroupsLink,
  groupsRefresh,
  resolveGroupsLink,
} from "./groupsLink";

/**
 * Applies a `/groups?tab=…&communityId=…` link as soon as the user's groups
 * hold the linked group, or once a refresh of them finishes, then clears it.
 */
export function useGroupsLink<Tab extends string>({
  isTab,
  onApply,
}: {
  isTab: (value: string | undefined) => value is Tab;
  onApply: (link: GroupsLink<Tab>) => void;
}) {
  const { communities, isFetching, isError, refreshCommunities } =
    useMyCommunities({});
  const { tab: tabParam, communityId: communityIdParam } =
    useLocalSearchParams<{ tab?: string; communityId?: string }>();
  const hasLinkParams =
    tabParam !== undefined || communityIdParam !== undefined;
  const [linkRefreshed, setLinkRefreshed] = useState(false);
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  // The cached list can predate the join a link announces.
  useEffect(() => {
    if (!hasLinkParams) return;
    let cancelled = false;
    void refreshCommunities().then(() => {
      if (!cancelled) setLinkRefreshed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasLinkParams, refreshCommunities]);

  // Cleared once settled, so a later visit with the same link applies it again.
  useEffect(() => {
    if (!hasLinkParams) return;
    const link = resolveGroupsLink({
      communityIds: communities.map((c) => c.id),
      refresh: groupsRefresh({ linkRefreshed, isFetching, isError }),
      isTab,
      tabParam,
      communityIdParam,
    });
    if (link === null) return;
    R.match(link, {
      success: onApply,
      failure: (failure) => {
        const { title, message } = GROUPS_LINK_ALERTS[failure];
        Alert.alert(title, message);
      },
    });
    setLinkRefreshed(false);
    navigation.setParams({ tab: undefined, communityId: undefined });
  }, [
    hasLinkParams,
    linkRefreshed,
    isFetching,
    isError,
    communities,
    isTab,
    onApply,
    tabParam,
    communityIdParam,
    navigation,
  ]);
}
