import { R, type Result } from "@alliance/common/result";
import type { KoraBatchDto } from "@alliance/shared/client";
import { dateInputValue } from "../../lib/koraParticipants";

// kora-pool.ts OPEN_BATCH: the batches the server draws assignments from.
export const isOpen = (batch: KoraBatchDto, now: Date) =>
  !batch.retiredAt && (!batch.closesAt || new Date(batch.closesAt) > now);

/** The closing day's field error: the server refuses a closing time already past. */
export const closingDateError = (value: string): string | null => {
  if (value === "") return "Choose the day the batch closes";
  if (value < dateInputValue(new Date())) return "Choose today or a later day";
  return null;
};

export type BatchSettings = {
  transcriptsPerAssignment: string;
  reviewsPerTranscript: string;
  closesOn: string;
};

export type BatchSettingsErrors = Partial<Record<keyof BatchSettings, string>>;

// The bounds `UploadKoraBatchDto` enforces.
const wholeNumberError = (value: string, max: number): string | null => {
  const n = Number(value);
  return value.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= max
    ? null
    : `Enter a whole number from 1 to ${max}`;
};

export const validateBatchSettings = (
  values: BatchSettings,
): Result<
  {
    transcriptsPerAssignment: number;
    reviewsPerTranscript: number;
    closesOn: string;
  },
  BatchSettingsErrors
> => {
  const errors: BatchSettingsErrors = {};
  const perAssignment = wholeNumberError(values.transcriptsPerAssignment, 100);
  const perTranscript = wholeNumberError(values.reviewsPerTranscript, 50);
  const closes = closingDateError(values.closesOn);
  if (perAssignment) errors.transcriptsPerAssignment = perAssignment;
  if (perTranscript) errors.reviewsPerTranscript = perTranscript;
  if (closes) errors.closesOn = closes;
  return Object.keys(errors).length > 0
    ? R.failure(errors)
    : R.success({
        transcriptsPerAssignment: Number(values.transcriptsPerAssignment),
        reviewsPerTranscript: Number(values.reviewsPerTranscript),
        closesOn: values.closesOn,
      });
};
