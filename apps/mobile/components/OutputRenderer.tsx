import type { AnyField } from "@alliance/common/forms/form-schema";
import type { ResolvedOutputFieldItem } from "@alliance/shared/outputrenderer";
import { cn } from "@alliance/shared/styles/util";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import {
  useOutputItems,
  type OutputSource,
} from "@alliance/shared/useOutputItems";
import { Image, View } from "react-native";
import { getImageSource } from "../lib/config";
import { RenderDisplayBlockMobile } from "./forms/FormRenderer";
import { RenderField } from "./forms/RenderField";
import Card, { CardStyle } from "./system/Card";
import Text, { FontWeight } from "./system/Text";

type OutputRendererProps = OutputSource & { className?: string };

const canUseMobileFieldRenderer = (field: AnyField): boolean =>
  field.kind !== "contract" && field.kind !== "custom" && field.kind !== "file";

const renderFormattedOutputFieldValue = (item: ResolvedOutputFieldItem) => {
  if (!item.field) {
    return (
      <Text className="text-xs text-zinc-500">Field removed from form.</Text>
    );
  }

  if (item.field.kind === "file") {
    if (!item.fileValues.length) {
      return <Text className="text-xs text-zinc-500">No file uploaded</Text>;
    }
    return (
      <View className="flex-row flex-wrap gap-2">
        {item.fileValues.map((fileValue) => (
          <Image
            key={fileValue}
            source={{ uri: getImageSource(fileValue) }}
            className="w-36 h-36 rounded-lg bg-zinc-200"
            resizeMode="cover"
          />
        ))}
      </View>
    );
  }

  if (!item.formattedValue) {
    return <Text className="text-sm text-zinc-400">No response</Text>;
  }

  return <Text className="text-base text-zinc-900">{item.formattedValue}</Text>;
};

function OutputRenderer({ className = "", ...source }: OutputRendererProps) {
  const items = useOutputItems(source);
  if (items.length === 0) {
    return null;
  }

  return (
    <Card cardStyle={CardStyle.Grey}>
      <View className={cn("gap-2", className)}>
        {items.map((item, index) => {
          if (item.type === "display") {
            return (
              <View
                key={item.key}
                className={cn(
                  item.block.kind === "header" && index > 0 && "pt-4",
                )}
              >
                <RenderDisplayBlockMobile block={item.block} />
              </View>
            );
          }

          if (item.format === "card") {
            return (
              <Card key={item.key}>
                {item.showLabel && (
                  <Text className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                    {item.label}
                  </Text>
                )}
                <View>{renderFormattedOutputFieldValue(item)}</View>
              </Card>
            );
          }

          if (item.format === "textonly") {
            return (
              <View key={item.key} className="flex-row flex-wrap items-center">
                {item.showLabel && (
                  <Text className="text-zinc-700" weight={FontWeight.Medium}>
                    {item.label}:{" "}
                  </Text>
                )}
                <View>{renderFormattedOutputFieldValue(item)}</View>
              </View>
            );
          }

          if (!item.renderField) {
            return null;
          }

          return (
            <View key={item.key} className="gap-1">
              {item.renderField &&
              canUseMobileFieldRenderer(item.renderField) ? (
                <RenderField
                  field={item.renderField}
                  value={item.value}
                  disabled
                  isOutputView
                  fieldContext={staticFieldContext}
                />
              ) : (
                renderFormattedOutputFieldValue(item)
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

export default OutputRenderer;
