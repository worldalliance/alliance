import {
  deviceVisibilityTargetSchema,
  type DeviceVisibilityTarget,
} from "@alliance/common/forms/device";
import type { FormSchema, FormValue } from "@alliance/common/forms/form-schema";
import type { VisibilityValidatorResults } from "@alliance/common/forms/visibility";
import { R } from "@alliance/common/result";
import { useMemo } from "react";
import type { FormResponseDto, FormResponseOutputDto } from "./client";
import { formRandomizationKey } from "./formrenderer";
import { resolveOutputItems, type ResolvedOutputItem } from "./outputrenderer";
import { parseVisibilityValidatorResults } from "./parsed-dtos";

/** Explicit values override the matching ones stored on `submission`. */
export type OutputSource = {
  schema?: FormSchema;
  submission?: FormResponseOutputDto | FormResponseDto | null;
  answers?: Record<string, FormValue>;
  viewId?: string;
  validatorResults?: VisibilityValidatorResults;
  deviceType?: DeviceVisibilityTarget;
  /** The member who submitted `submission`, whose pick a `random` input shows. */
  submitterId?: number;
};

type SubmissionWithPublicAnswers =
  | (FormResponseOutputDto & { publicAnswers?: Record<string, boolean> })
  | (FormResponseDto & { publicAnswers?: Record<string, boolean> });

/** The items of the selected output view; empty without a schema or when it has no output views. */
export function useOutputItems({
  schema,
  submission,
  answers,
  viewId,
  validatorResults,
  deviceType,
  submitterId,
}: OutputSource): ResolvedOutputItem[] {
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
  const resolvedValidatorResults = useMemo(
    () =>
      validatorResults ??
      (submission
        ? R.unwrapOr(
            parseVisibilityValidatorResults(
              submission.visibilityValidatorResults,
            ),
            {},
          )
        : undefined),
    [validatorResults, submission],
  );
  const resolvedDeviceType =
    deviceType ??
    deviceVisibilityTargetSchema.safeParse(submission?.deviceType).data;
  const resolvedPublicAnswers = (
    submission as SubmissionWithPublicAnswers | undefined
  )?.publicAnswers;
  const randomizationKey =
    submission && submitterId !== undefined
      ? formRandomizationKey({
          formId: submission.formId,
          activeUserKey: String(submitterId),
        })
      : undefined;

  return useMemo(
    () =>
      effectiveSchema
        ? resolveOutputItems({
            schema: effectiveSchema,
            answers: resolvedAnswers,
            viewId,
            validatorResults: resolvedValidatorResults,
            deviceType: resolvedDeviceType,
            publicAnswers: resolvedPublicAnswers,
            randomizationKey,
          }).items
        : [],
    [
      effectiveSchema,
      resolvedAnswers,
      viewId,
      resolvedValidatorResults,
      resolvedDeviceType,
      resolvedPublicAnswers,
      randomizationKey,
    ],
  );
}
