import type { OptionCategory } from "@alliance/common/forms/options-schema";
import { matchesOptionSearch } from "./optionSearch";
import { shuffleWithSeed } from "./randomutils";

export type OptionSection<O> = {
  category: OptionCategory | null;
  items: O[];
};

/** An option naming a category missing from `categoryIds` is uncategorized. */
export function optionSectionId(
  option: { category?: string },
  categoryIds: ReadonlySet<string>,
): string | undefined {
  return option.category !== undefined && categoryIds.has(option.category)
    ? option.category
    : undefined;
}

/**
 * Uncategorized options first, counting any whose category is missing from
 * `categories`, then each category in authored order; empty sections are
 * omitted. Options keep their relative order in `options`, or are shuffled
 * within their section when `shuffleSeed` is set.
 */
export function optionSections<
  O extends object & { category?: string },
>(params: {
  options: O[];
  categories?: OptionCategory[];
  shuffleSeed?: string;
}): OptionSection<O>[] {
  const { options, categories = [], shuffleSeed } = params;
  const ids = new Set(categories.map((category) => category.id));
  return [null, ...categories].flatMap((category) => {
    const members = options.filter(
      (option) => optionSectionId(option, ids) === category?.id,
    );
    if (members.length === 0) return [];
    // The uncategorized section uses the field's own seed so fields without
    // categories keep the order already shown to respondents.
    const seed =
      shuffleSeed && (category ? `${shuffleSeed}:${category.id}` : shuffleSeed);
    return [
      { category, items: seed ? shuffleWithSeed(members, seed) : members },
    ];
  });
}

/**
 * Keeps every option of a category whose name matches `query`, and elsewhere
 * only options whose text matches, dropping sections left empty.
 */
export function filterOptionSections<O>(
  sections: OptionSection<O>[],
  params: { query: string; text: (option: O) => string },
): OptionSection<O>[] {
  return sections.flatMap((section) => {
    if (
      section.category &&
      matchesOptionSearch({ label: section.category.name }, params.query)
    ) {
      return [section];
    }
    const items = section.items.filter((option) =>
      matchesOptionSearch({ label: params.text(option) }, params.query),
    );
    return items.length > 0 ? [{ ...section, items }] : [];
  });
}
