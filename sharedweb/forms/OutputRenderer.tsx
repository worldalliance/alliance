import type { DeviceVisibilityTarget } from "@alliance/common/forms/device";
import type { FormSchema, FormValue } from "@alliance/common/forms/form-schema";
import type {
  FormResponseDto,
  FormResponseOutputDto,
} from "@alliance/shared/client";
import {
  resolveOutputItems,
  resolveOutputView,
  type ResolvedOutputFieldItem,
} from "@alliance/shared/outputrenderer";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { useMemo, type ReactNode } from "react";
import { getApiUrl } from "../lib/config";
import Card from "../ui/Card";
import { ImageThumbnailGrid } from "../ui/ImageLightbox";
import RenderDisplayBlock from "./RenderDisplayBlock";
import RenderField from "./RenderField";

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

const renderOutputFieldValue = (item: ResolvedOutputFieldItem): ReactNode => {
  if (!item.field) {
    return (
      <span className="text-xs text-gray-500">Field removed from form.</span>
    );
  }
  if (item.field.kind === "file") {
    if (!item.fileValues.length) {
      return <span className="text-xs text-gray-500">No file uploaded</span>;
    }
    const imageUrls = item.fileValues.map(
      (entry) => `${getApiUrl()}/images/${entry}`,
    );
    return <ImageThumbnailGrid images={imageUrls} alt="Uploaded file" />;
  }
  if (!item.formattedValue) {
    return <span className="text-sm text-gray-400">No response</span>;
  }
  return <span className="text-sm text-gray-900">{item.formattedValue}</span>;
};

export function OutputRenderer({
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
    ],
  );

  if (!selectedView || !effectiveSchema) {
    return null;
  }

  if (!resolvedOutput || resolvedOutput.items.length === 0) {
    return null;
  }

  return (
    <Card style={CardStyle.LightGrey}>
      <div className={cn("space-y-2", className)}>
        {resolvedOutput.items.map((item, index) => {
          if (item.type === "display") {
            return (
              <div
                key={item.key}
                className={cn(
                  item.block.kind === "header" && index > 0 && "pt-4",
                )}
              >
                <RenderDisplayBlock block={item.block} />
              </div>
            );
          }

          const content = renderOutputFieldValue(item);
          if (item.format === "card") {
            return (
              <Card key={item.key}>
                {item.showLabel && (
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    {item.label}
                  </p>
                )}
                <div className="text-lg">{content}</div>
              </Card>
            );
          }
          if (item.format === "textonly") {
            return (
              <div key={item.key} className="text-sm text-gray-900">
                {item.showLabel && (
                  <span className="font-medium text-gray-700">
                    {item.label}:{" "}
                  </span>
                )}
                {content}
              </div>
            );
          }
          if (!item.renderField) {
            return null;
          }
          return (
            <div key={item.key} className="space-y-1">
              <RenderField
                field={item.renderField}
                value={item.value}
                disabled
                isOutputView
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default OutputRenderer;
