import { customLinkFieldsSchema } from "@alliance/common/customLinks";
import { R, type Result } from "@alliance/common/result";
import type { CustomLinkDto } from "@alliance/shared/client";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";

export type CustomLinkValues = {
  label: string;
  slug: string;
  destination: string;
};
type FieldName = keyof CustomLinkValues;
export type CustomLinkErrors = Partial<Record<FieldName, string>>;

export const EMPTY_CUSTOM_LINK: CustomLinkValues = {
  label: "",
  slug: "",
  destination: "",
};

const REQUIRED: Record<FieldName, string> = {
  label: "Enter a label",
  slug: "Enter a path",
  destination: "Enter a destination",
};
const FIELDS: readonly FieldName[] = ["label", "slug", "destination"];

/** The values as the server stores them, or what to fix, by field. */
export function validateCustomLink(
  values: CustomLinkValues,
): Result<CustomLinkValues, CustomLinkErrors> {
  const errors: CustomLinkErrors = {};
  for (const field of FIELDS) {
    if (values[field].trim() === "") errors[field] = REQUIRED[field];
  }
  const parsed = customLinkFieldsSchema.safeParse(values);
  if (parsed.success) return R.success(parsed.data);
  for (const issue of parsed.error.issues) {
    const field = FIELDS.find((name) => name === issue.path[0]);
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return R.failure(errors);
}

/** The fields of `next` that differ from the stored link, as an update's body. */
export function customLinkChanges(
  link: CustomLinkDto,
  next: CustomLinkValues,
): Partial<CustomLinkValues> {
  const changes: Partial<CustomLinkValues> = {};
  for (const field of FIELDS) {
    if (next[field] !== link[field]) changes[field] = next[field];
  }
  return changes;
}

export const customLinkUrl = (slug: string) => `${getInviteBaseUrl()}/${slug}`;

export const matchesCustomLink = (link: CustomLinkDto, q: string) => {
  const needle = q.trim().toLowerCase();
  return [link.label, `/${link.slug}`, link.destination].some((text) =>
    text.toLowerCase().includes(needle),
  );
};
