import type { ChoiceField, ChoiceOption } from "./formula-options";

export function categorizedOptions(
  choices: readonly ChoiceOption[],
): Pick<ChoiceField, "options" | "categories"> {
  const names = new Set(choices.flatMap(({ category }) => category ?? []));
  return {
    options: [...choices],
    categories:
      names.size > 0
        ? [...names].map((name) => ({ id: name, name }))
        : undefined,
  };
}
