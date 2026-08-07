import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { View } from "react-native";
import { RenderDisplayBlockMobile } from "./forms/FormRenderer";
import Text from "./system/Text";

export default function DisplayOnlyRenderer({
  schema,
}: {
  schema: DisplayOnlySchema | null;
}) {
  if (!schema) {
    return (
      <View className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <Text className="text-amber-800">
          This update can&apos;t be displayed
        </Text>
        <Text className="text-sm text-amber-800 mt-1">
          Updating the app may fix the issue.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-y-4">
      {schema.blocks.map((block, index) => (
        <View key={block.id ?? `block-${index}`}>
          <RenderDisplayBlockMobile
            block={block}
            hasRenderedNeighborAbove={index > 0}
            hasRenderedNeighborBelow={index < schema.blocks.length - 1}
          />
        </View>
      ))}
    </View>
  );
}
