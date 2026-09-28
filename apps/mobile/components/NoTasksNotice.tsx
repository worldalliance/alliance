import { noTasksToDoRightNow } from "@alliance/shared/lib/copy";
import { Check } from "lucide-react-native";
import { View } from "react-native";
import { colors } from "../lib/style/colors";
import Text from "./system/Text";

export default function NoTasksNotice() {
  return (
    <View>
      <View
        className="items-center justify-center py-10 px-5"
        style={{ backgroundColor: colors.grey[0] }}
      >
        <View className="w-8 h-8 rounded-full bg-green items-center justify-center mb-4">
          <Check size={20} color="#fff" strokeWidth={3} />
        </View>
        <Text className="text-zinc-500 text-base text-center">
          {noTasksToDoRightNow}
        </Text>
      </View>
    </View>
  );
}
