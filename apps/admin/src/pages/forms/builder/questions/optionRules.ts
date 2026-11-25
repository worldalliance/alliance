type Option = { label: string; value: string };

/** How a question's default answer holds options: one value, or a list of them. */
export enum DefaultKind {
  One = "one",
  Many = "many",
}

export type OptionDefaults =
  | { kind: DefaultKind.One; value: unknown }
  | { kind: DefaultKind.Many; value: unknown };

type OptionsWrite<O> =
  | { options: O[]; defaultValue?: string | null }
  | { options: O[]; defaultValue?: string[] | null };

export const newOption = (count: number): Option => ({
  label: `Option ${count + 1}`,
  value: `option${count + 1}`,
});

export function defaultList(value: unknown): string[] {
  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === "string")
    ? value
    : [];
}

export function isDefault(defaults: OptionDefaults, value: string): boolean {
  switch (defaults.kind) {
    case DefaultKind.One:
      return defaults.value === value;
    case DefaultKind.Many:
      return defaultList(defaults.value).includes(value);
    default:
      throw new Error(`unknown default kind: ${defaults satisfies never}`);
  }
}

/** Renaming an option's value carries the default along with it. */
export function editOption<O extends Option>(params: {
  options: O[];
  index: number;
  updates: { label?: string; value?: string };
  defaults: OptionDefaults;
}): OptionsWrite<O> {
  const { options, index, updates, defaults } = params;
  const previousValue = options[index]?.value;
  const next = options.map((option, i) =>
    i === index ? { ...option, ...updates } : option,
  );
  if (updates.value === undefined) return { options: next };
  switch (defaults.kind) {
    case DefaultKind.One:
      return previousValue === defaults.value &&
        updates.value !== defaults.value
        ? { options: next, defaultValue: updates.value || null }
        : { options: next };
    case DefaultKind.Many: {
      const list = defaultList(defaults.value);
      if (!previousValue || !list.includes(previousValue)) {
        return { options: next };
      }
      const kept = list.filter((value) => value !== previousValue);
      if (updates.value) kept.push(updates.value);
      return { options: next, defaultValue: kept.length > 0 ? kept : null };
    }
    default:
      throw new Error(`unknown default kind: ${defaults satisfies never}`);
  }
}

/** Removing the default option clears it from the default. */
export function removeOption<O extends Option>(params: {
  options: O[];
  index: number;
  defaults: OptionDefaults;
}): OptionsWrite<O> {
  const { options, index, defaults } = params;
  const removed = options[index]?.value;
  const next = options.filter((_, i) => i !== index);
  switch (defaults.kind) {
    case DefaultKind.One:
      return removed && removed === defaults.value
        ? { options: next, defaultValue: null }
        : { options: next };
    case DefaultKind.Many: {
      const list = defaultList(defaults.value);
      if (!removed || !list.includes(removed)) return { options: next };
      const kept = list.filter((value) => value !== removed);
      return { options: next, defaultValue: kept.length > 0 ? kept : null };
    }
    default:
      throw new Error(`unknown default kind: ${defaults satisfies never}`);
  }
}

export function toggleManyDefault(params: {
  value: unknown;
  option: string;
  checked: boolean;
}): string[] | null {
  const defaults = new Set(defaultList(params.value));
  if (params.checked) defaults.add(params.option);
  else defaults.delete(params.option);
  return defaults.size > 0 ? Array.from(defaults) : null;
}

/** Writes a section's reordered options back into the slots the section holds. */
export function writeSection<O>(params: {
  options: readonly O[];
  indices: readonly number[];
  section: readonly O[];
}): O[] {
  const next = [...params.options];
  params.indices.forEach((slot, position) => {
    next[slot] = params.section[position];
  });
  return next;
}

/** Swaps two options, as a move up or down within a section does. */
export function swapOptions<O>(options: readonly O[], a: number, b: number) {
  const next = [...options];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
