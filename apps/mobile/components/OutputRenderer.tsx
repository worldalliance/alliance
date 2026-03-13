import { useMemo } from "react";
import { Image, View } from "react-native";
import type {
  FormResponseDto,
  FormResponseOutputDto,
} from "@alliance/shared/client";
import {
  resolveOutputItems,
  resolveOutputView,
  type ResolvedOutputFieldItem,
} from "@alliance/shared/outputrenderer";
import type {
  AnyField,
  DeviceVisibilityTarget,
  FormSchema,
  FormValue,
} from "@alliance/shared/forms/formschema";
import { cn } from "@alliance/shared/styles/util";
import { getImageSource } from "../lib/config";
import Card, { CardStyle } from "./system/Card";
import Text from "./system/Text";
import { RenderDisplayBlockMobile } from "./forms/FormRenderer";
import { RenderField } from "./forms/RenderField";

type OutputRendererProps = {
  schema?: FormSchema;
  submission?: FormResponseOutputDto | FormResponseDto | null;
  answers?: Record<string, FormValue>;
  viewId?: string;
  validatorResults?: Record<number, boolean>;
  deviceType?: DeviceVisibilityTarget;
  className?: string;
};

type SubmissionWithPublicAnswers =
  | (FormResponseOutputDto & { publicAnswers?: Record<string, boolean> })
  | (FormResponseDto & { publicAnswers?: Record<string, boolean> });

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
            className="w-24 h-24 rounded-lg bg-zinc-200"
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

function OutputRenderer({
  schema,
  submission,
  answers,
  viewId,
  validatorResults,
  deviceType,
  className = "",
}: OutputRendererProps) {
  const effectiveSchema =
    schema ?? (submission?.schemaSnapshot as unknown as FormSchema | undefined);
  const resolvedAnswers = useMemo((): Record<string, FormValue> => {
    if (answers) {
      return answers;
    }
    if (submission?.answers) {
      return submission.answers as Record<string, FormValue>;
    }
    return {};
  }, [answers, submission]);
  const resolvedValidatorResults =
    validatorResults ??
    (submission?.visibilityValidatorResults as Record<number, boolean>) ??
    undefined;
  const resolvedDeviceType =
    deviceType ?? (submission?.deviceType as DeviceVisibilityTarget);
  const resolvedPublicAnswers = (
    submission as SubmissionWithPublicAnswers | undefined
  )?.publicAnswers;
  const selectedView = effectiveSchema
    ? resolveOutputView(effectiveSchema, viewId)
    : null;
  const resolvedOutput = useMemo(
    () =>
      effectiveSchema
        ? resolveOutputItems({
            schema: effectiveSchema,
            answers: resolvedAnswers,
            viewId,
            validatorResults: resolvedValidatorResults,
            deviceType: resolvedDeviceType,
            publicAnswers: resolvedPublicAnswers,
          })
        : null,
    [
      effectiveSchema,
      resolvedAnswers,
      viewId,
      resolvedValidatorResults,
      resolvedDeviceType,
      resolvedPublicAnswers,
    ]
  );

  if (!selectedView || !effectiveSchema) {
    return (
      <View className={className}>
        <Text className="text-sm text-zinc-500">
          No output views configured for this form.
        </Text>
      </View>
    );
  }

  if (!resolvedOutput || resolvedOutput.items.length === 0) {
    return null;
  }

  return (
    <Card cardStyle={CardStyle.Grey}>
      <View className={cn("gap-2", className)}>
        {resolvedOutput.items.map((item) => {
          if (item.type === "display") {
            return (
              <RenderDisplayBlockMobile block={item.block} key={item.key} />
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
                  <Text className="font-medium text-zinc-700">
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
              {item.renderField && canUseMobileFieldRenderer(item.renderField) ? (
                <RenderField
                  field={item.renderField}
                  value={item.value}
                  disabled
                  isOutputView
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
