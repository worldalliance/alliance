import type {
  AnyField,
  CheckboxField,
  CityField,
  CustomComponentField,
  PhoneField,
  TimeField,
  TimezoneField,
} from "@alliance/common/forms/form-schema";
import { AUTO_EXTRACT_FIELD_KINDS } from "@alliance/common/forms/form-schema";

type ExtractableField =
  | PhoneField
  | TimeField
  | TimezoneField
  | CityField
  | CheckboxField
  | CustomComponentField;

export function supportsExtraction(field: AnyField): field is ExtractableField {
  return AUTO_EXTRACT_FIELD_KINDS.includes(
    field.kind as (typeof AUTO_EXTRACT_FIELD_KINDS)[number],
  );
}

export function hasExtractionEnabled(field: AnyField): boolean {
  if (!supportsExtraction(field)) return false;
  if (field.kind === "checkbox" || field.kind === "custom") {
    return Boolean(field.autoExtractUserData?.target);
  }
  return Boolean(field.autoExtractUserData);
}

export function getExtractionLabel(field: AnyField): string {
  if (field.kind === "checkbox" || field.kind === "custom") {
    const target = field.autoExtractUserData?.target;
    if (target === "shareInfoPublicly") {
      return "Extracting into: Share info publicly";
    }
    return "Extracting into user data";
  }
  const labels: Record<string, string> = {
    phone: "Extracting into: Phone number",
    time: "Extracting into: Preferred reminder time",
    timezone: "Extracting into: Time zone",
    city: "Extracting into: City",
  };
  return labels[field.kind] || "Extracting into user data";
}
