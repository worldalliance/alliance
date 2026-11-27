import type {
  AnyField,
  AutoExtractFieldKind,
  CheckboxExtractionTarget,
} from "@alliance/common/forms/form-schema";
import { AUTO_EXTRACT_FIELD_KINDS } from "@alliance/common/forms/form-schema";

type ExtractableField = Extract<AnyField, { kind: AutoExtractFieldKind }>;

const TARGET_EXTRACTION_KINDS = ["checkbox", "toggle", "custom"] as const;

type TargetExtractionField = Extract<
  AnyField,
  { kind: (typeof TARGET_EXTRACTION_KINDS)[number] }
>;

/** Fields that extract into a chosen target rather than one fixed by their kind. */
export function extractsIntoTarget(
  field: AnyField,
): field is TargetExtractionField {
  return TARGET_EXTRACTION_KINDS.some((kind) => kind === field.kind);
}

export function supportsExtraction(field: AnyField): field is ExtractableField {
  return AUTO_EXTRACT_FIELD_KINDS.some((kind) => kind === field.kind);
}

export function hasExtractionEnabled(field: ExtractableField): boolean {
  if (extractsIntoTarget(field)) {
    return Boolean(field.autoExtractUserData?.target);
  }
  return Boolean(field.autoExtractUserData);
}

const INTO_PROFILE_PHOTO = "Extracting into: Profile photo";
const INTO_REMINDER_TIME = "Extracting into: Preferred reminder time";

const SCALAR_EXTRACTION_LABELS: Record<
  Exclude<AutoExtractFieldKind, TargetExtractionField["kind"]>,
  string
> = {
  phone: "Extracting into: Phone number",
  time: INTO_REMINDER_TIME,
  timezone: "Extracting into: Time zone",
  city: "Extracting into: City",
  textarea: "Extracting into: Profile description",
  file: INTO_PROFILE_PHOTO,
  image: INTO_PROFILE_PHOTO,
  timePicker: INTO_REMINDER_TIME,
};

export const CHECKBOX_TARGET_LABELS: Record<CheckboxExtractionTarget, string> =
  {
    shareInfoPublicly: "Share info publicly",
    textNotifications: "Text notifications",
    emailNotifications: "Email notifications",
  };

export function getExtractionLabel(field: ExtractableField): string {
  if (extractsIntoTarget(field)) {
    const target = field.autoExtractUserData?.target;
    return target
      ? `Extracting into: ${CHECKBOX_TARGET_LABELS[target]}`
      : "Extracting into user data";
  }
  return SCALAR_EXTRACTION_LABELS[field.kind];
}
