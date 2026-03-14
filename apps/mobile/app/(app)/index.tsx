import { View, ActivityIndicator } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import {
  actionsDismissAction,
  actionsDismissGeneralUpdate,
  actionsFindAllLoggedIn,
  actionsUnreadGeneralUpdates,
  userGetAwayRanges,
} from "@alliance/shared/client";
import { colors } from "../../lib/style/colors";
import Text from "../../components/system/Text";
import {
  ActionWithAwayStatus,
  getAwayStatus,
  isGeneralUpdate,
  homePagePriorityComparator,
} from "@alliance/shared/lib/actionUtils";
import { useHomePageActions } from "@alliance/shared/lib/homePage";
import LargeActionCard from "../../components/LargeActionCard";
import LargeGeneralUpdateCard from "../../components/LargeGeneralUpdateCard";
import { Check } from "lucide-react-native";
import { noTasksToDoRightNow } from "@alliance/shared/lib/copy";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import type { GeneralUpdateDto } from "@alliance/shared/client";
import { useAuth } from "../../lib/AuthContext";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";

const GENERAL_UPDATES_QUERY_KEY = [
  "actions",
  "generalUpdates",
  "unread",
] as const;

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const {
    data: actions,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["actions"],
    queryFn: () =>
      actionsFindAllLoggedIn({ query: { sorted: true } }).then(
        (response) => response.data ?? [],
      ),
  });

  const { user } = useAuth();

  const { data: generalUpdates, isPending: generalUpdatesPending } = useQuery({
    queryKey: GENERAL_UPDATES_QUERY_KEY,
    queryFn: () =>
      actionsUnreadGeneralUpdates().then((response) => response.data ?? []),
  });

  const handleDismissAction = useCallback(
    async (actionId: number) => {
      const action = actions?.find((a) => a.id === actionId);
      if (!action) {
        return;
      }

      await actionsDismissAction({
        path: { id: action.id },
      });

      refetch();
    },
    [actions, refetch],
  );

  const { data: awayRanges, isPending: awayRangesPending } = useQuery({
    queryKey: ["awayRanges"],
    queryFn: () => userGetAwayRanges().then((response) => response.data ?? []),
  });

  const handleDismissGeneralUpdate = useCallback(
    async (generalUpdateId: number) => {
      await actionsDismissGeneralUpdate({
        path: { generalUpdateId },
      });
      queryClient.setQueryData<GeneralUpdateDto[]>(
        GENERAL_UPDATES_QUERY_KEY,
        (prev) => prev?.filter((u) => u.id !== generalUpdateId) ?? [],
      );
    },
    [queryClient],
  );

  const loading = isPending || awayRangesPending || generalUpdatesPending;

  const actionsWithAwayStatus = useMemo((): ActionWithAwayStatus[] => {
    if (!actions || !awayRanges) return [];
    return actions.map((action) => ({
      ...action,
      awayStatus: getAwayStatus(action, awayRanges, new Date()),
    }));
  }, [actions, awayRanges]);

  const { todoActions } = useHomePageActions(actionsWithAwayStatus);

  const currentTaskOrGeneralUpdate = useMemo(() => {
    return [...todoActions, ...(generalUpdates ?? [])].sort(
      homePagePriorityComparator,
    )[0];
  }, [todoActions, generalUpdates]);

  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);

  const scrollPageTo = useCallback((y: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: y,
        animated: true,
      });
    }
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-16 px-5 bg-white">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!currentTaskOrGeneralUpdate) {
    return (
      <View className="flex-1 ">
        <SimplePageTitle title="Actions" />

        <View
          className="flex-1 items-center justify-center py-16 px-5 bg-white"
          testID="vr-home-ready"
        >
          <View className="w-12 h-12 rounded-full bg-green items-center justify-center mb-4">
            <Check size={32} color="#fff" strokeWidth={3} />
          </View>
          <Text className="text-zinc-500 text-lg text-center">
            {noTasksToDoRightNow}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      className="flex-1 bg-white"
      bottomOffset={72}
      testID="vr-home-ready"
    >
      {currentTaskOrGeneralUpdate &&
      isGeneralUpdate(currentTaskOrGeneralUpdate) ? (
        <View className="p-4">
          <LargeGeneralUpdateCard
            key={currentTaskOrGeneralUpdate.id}
            generalUpdate={currentTaskOrGeneralUpdate}
            onDismiss={() =>
              handleDismissGeneralUpdate(currentTaskOrGeneralUpdate.id)
            }
            userId={user?.id}
            user={user}
          />
        </View>
      ) : (
        <>
          <SimplePageTitle title="Current task" />
          <View className="border-t border-zinc-200">
            {!currentTaskOrGeneralUpdate ? (
              <Text className="text-red-500 text-center py-4">
                {error?.message}
              </Text>
            ) : (
              <LargeActionCard
                action={currentTaskOrGeneralUpdate}
                userRelation={currentTaskOrGeneralUpdate.userRelation ?? "none"}
                onUpdateActionState={refetch}
                scrollPageTo={scrollPageTo}
                handleDismiss={() =>
                  handleDismissAction(currentTaskOrGeneralUpdate.id)
                }
              />
            )}
          </View>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}
