import type { AnyField } from "@alliance/common/forms/form-schema";
import { useMemo } from "react";
import { optionSections } from "./optionSections";

/**
 * A choice field's options as rendered, null for any other kind. The shuffle
 * seed combines `randomizationKey` with the field id, so web and mobile show
 * one respondent the same order.
 */
export function useFieldOptionSections(params: {
  field: AnyField;
  randomizationKey?: string;
  disableOptionRandomization?: boolean;
}) {
  const { field, randomizationKey, disableOptionRandomization } = params;
  const randomizationSeedBase =
    randomizationKey && randomizationKey.length > 0
      ? `${randomizationKey}:${field.id}`
      : field.id;
  const sections = useMemo(() => {
    if (
      field.kind !== "radio" &&
      field.kind !== "multiselect" &&
      field.kind !== "select"
    ) {
      return null;
    }
    return optionSections({
      options: field.options ?? [],
      categories: field.kind === "radio" ? undefined : field.categories,
      shuffleSeed:
        disableOptionRandomization || !field.randomizeOptions
          ? undefined
          : randomizationSeedBase,
    });
  }, [field, randomizationSeedBase, disableOptionRandomization]);
  const randomizedOptions = useMemo(
    () => sections?.flatMap((section) => section.items),
    [sections],
  );
  return { sections, randomizedOptions };
}
