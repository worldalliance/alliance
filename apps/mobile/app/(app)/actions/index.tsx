import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { FilterMode } from "@alliance/shared/lib/actionUtils";
import {
  filterActions,
  useActionsQuery,
} from "@alliance/shared/lib/actionsListPage";
import Text from "../../../components/system/Text";
import GreenHeader from "../../../components/GreenHeader";
import { ChevronDown } from "lucide-react-native";
import ActionItemCard from "../../../components/ActionItemCard";
import { LegendList } from "@legendapp/list";

export default function ActionsScreen() {
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: actions, isPending, error } = useActionsQuery();

  const counts = useMemo(() => {
    const result: Record<FilterMode, number> = {} as any;
    for (const mode of Object.values(FilterMode) as FilterMode[]) {
      result[mode] = filterActions(actions ?? [], mode).length;
    }
    return result;
  }, [actions]);

  const filteredActions = actions ? filterActions(actions, filterMode) : [];

  const navigateToAction = useCallback((actionId: number) => {
    router.push(`/actions/${actionId}`);
  }, []);

  return (
    <GreenHeader>
      {isPending ? (
        <View className="py-5 items-center justify-center">
          <ActivityIndicator size="large" color="#0D1B2A" />
        </View>
      ) : error ? (
        <Text className="text-center text-red-500 py-4">{error.message}</Text>
      ) : filteredActions.length === 0 ? (
        <Text className="text-center text-zinc-500 py-5">
          No matching actions
        </Text>
      ) : (
        <LegendList
          contentContainerStyle={{ backgroundColor: "white" }}
          ListHeaderComponent={
            <View className="flex-row items-center gap-x-3 border-b border-zinc-200 p-4 pt-12 justify-between bg-green pb-3">
              <Text className="text-white font-bold">All Actions</Text>
              <View className="flex-row items-center gap-x-2">
                <Text className="text-sm text-white font-medium">
                  Filter by:
                </Text>
                <View className="relative">
                  <TouchableOpacity
                    onPress={() => setDropdownOpen(!dropdownOpen)}
                    className="flex-row items-center gap-x-2 px-3 py-2 bg-white rounded"
                  >
                    <Text className="text-sm text-black">{filterMode}</Text>
                    <ChevronDown size={15} color="black" />
                  </TouchableOpacity>

                  <Modal
                    visible={dropdownOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setDropdownOpen(false)}
                  >
                    <Pressable
                      className="flex-1 bg-black/20"
                      onPress={() => setDropdownOpen(false)}
                    >
                      <View className="mx-4 mt-32 bg-white border border-zinc-200 rounded overflow-hidden">
                        {(Object.values(FilterMode) as FilterMode[]).map(
                          (mode) => (
                            <TouchableOpacity
                              key={mode}
                              onPress={() => {
                                setFilterMode(mode);
                                setDropdownOpen(false);
                              }}
                              className="px-4 py-3 border-b border-zinc-100 flex-row justify-between items-center"
                            >
                              <Text className="text-sm text-black">{mode}</Text>
                              <Text className="text-sm text-zinc-500 font-mono">
                                {counts[mode]}
                              </Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    </Pressable>
                  </Modal>
                </View>
              </View>
            </View>
          }
          data={filteredActions}
          keyExtractor={(item) => item.id.toString()}
          recycleItems
          renderItem={({ item }) => (
            <View key={item.id} className="border-b border-zinc-200">
              <ActionItemCard
                action={item}
                onPress={() => navigateToAction(item.id)}
              />
            </View>
          )}
        />
      )}
    </GreenHeader>
  );
}
