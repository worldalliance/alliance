import type {
  AnyField,
  AutoExtractFieldKind,
} from "@alliance/common/forms/form-schema";
import { AUTO_EXTRACT_FIELD_KINDS } from "@alliance/common/forms/form-schema";

type ExtractableField = Extract<AnyField, { kind: AutoExtractFieldKind }>;

export function supportsExtraction(field: AnyField): field is ExtractableField {
  return AUTO_EXTRACT_FIELD_KINDS.some((kind) => kind === field.kind);
}

export function hasExtractionEnabled(field: ExtractableField): boolean {
  if (field.kind === "checkbox" || field.kind === "custom") {
    return Boolean(field.autoExtractUserData?.target);
  }
  return Boolean(field.autoExtractUserData);
}

const SCALAR_EXTRACTION_LABELS: Record<
  Exclude<AutoExtractFieldKind, "checkbox" | "custom">,
  string
> = {
  phone: "Extracting into: Phone number",
  time: "Extracting into: Preferred reminder time",
  timezone: "Extracting into: Time zone",
  city: "Extracting into: City",
};

export function getExtractionLabel(field: ExtractableField): string {
  if (field.kind === "checkbox" || field.kind === "custom") {
    const target = field.autoExtractUserData?.target;
    if (target === "shareInfoPublicly") {
      return "Extracting into: Share info publicly";
    }
    return "Extracting into user data";
  }
  return SCALAR_EXTRACTION_LABELS[field.kind];
}
