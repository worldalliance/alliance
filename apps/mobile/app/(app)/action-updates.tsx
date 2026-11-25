import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import {
  useActionUpdateNewState,
  useAllActionUpdates,
} from "@alliance/shared/lib/useActionUpdates";
import { LegendList } from "@legendapp/list";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import HomeUpdateCard from "../../components/HomeUpdateCard";
import LoadFailed from "../../components/LoadFailed";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text from "../../components/system/Text";
import { colors } from "../../lib/style/colors";

export default function ActionUpdatesScreen() {
  const updatesQuery = useAllActionUpdates();
  const { data, isPending, isFetching, isRefetching, refetch } = updatesQuery;
  const { isNew, markOpened } = useActionUpdateNewState(data);

  return (
    <View className="flex-1 bg-white">
      <SimplePageTitle title="Project updates" backButton fallbackRoute="/" />
      {failedToLoad(updatesQuery) ? (
        <LoadFailed
          message="Couldn't load action updates."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <LegendList
          data={data ?? []}
          keyExtractor={(update) => String(update.id)}
          extraData={isNew}
          renderItem={({ item }) => (
            <View className="px-4 pb-4">
              <HomeUpdateCard
                update={item}
                isNew={isNew(item.id)}
                onOpen={markOpened}
              />
            </View>
          )}
          ListEmptyComponent={
            <Text className="px-4 text-zinc-500">No updates yet.</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
            />
          }
        />
      )}
    </View>
  );
}
