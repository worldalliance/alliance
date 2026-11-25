import { R, type Result } from "@alliance/common/result";
import type { CreateTagDto, TagDto } from "@alliance/shared/client/types.gen";

export type TagFormValues = Record<keyof CreateTagDto, string>;
export type TagFormErrors = { name?: string; description?: string };

export const NEW_TAG: TagFormValues = {
  name: "",
  description: "",
  publicDisplayName: "",
};

export const valuesOf = (tag: TagDto): TagFormValues => ({
  name: tag.name,
  description: tag.description,
  publicDisplayName: tag.publicDisplayName ?? "",
});

export const byTagName = (a: TagDto, b: TagDto) => a.name.localeCompare(b.name);

/**
 * The checks a tag form runs before saving, each failure on the field that
 * fixes it, and the body to send: trimmed, an empty public name as `null`.
 */
export function validateTag({
  values,
  otherNames,
  descriptionRequired,
}: {
  values: TagFormValues;
  /** The names of every other tag: the server keeps names unique. */
  otherNames: readonly string[];
  /** A new tag needs one; a tag saved without one can still be renamed. */
  descriptionRequired: boolean;
}): Result<CreateTagDto, TagFormErrors> {
  const name = values.name.trim();
  const description = values.description.trim();
  const errors: TagFormErrors = {};
  if (!name) errors.name = "Enter a name";
  else if (otherNames.includes(name))
    errors.name = "Enter a name no other tag has";
  if (descriptionRequired && !description)
    errors.description = "Enter a description";
  if (errors.name || errors.description) return R.failure(errors);
  return R.success({
    name,
    description,
    publicDisplayName: values.publicDisplayName.trim() || null,
  });
}
