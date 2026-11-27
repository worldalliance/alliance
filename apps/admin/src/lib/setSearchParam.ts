/** The values a comma-separated search param names; `defaults` when it is absent. */
export function readSetParam<T extends string>(params: {
  param: string | null;
  values: readonly T[];
  defaults: readonly T[];
}): Set<T> {
  const { param, values, defaults } = params;
  if (param === null) return new Set(defaults);
  const named = new Set(param.split(","));
  return new Set(values.filter((value) => named.has(value)));
}

/** The search param for `selected`, in `values` order, or null for the defaults. */
export function writeSetParam<T extends string>(params: {
  selected: ReadonlySet<string>;
  values: readonly T[];
  defaults: readonly T[];
}): string | null {
  const { selected, values, defaults } = params;
  const param = values.filter((value) => selected.has(value)).join(",");
  const defaultParam = values
    .filter((value) => defaults.includes(value))
    .join(",");
  return param === defaultParam ? null : param;
}
