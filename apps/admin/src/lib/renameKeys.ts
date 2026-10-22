/** Keeps only the keys `renames` names, each under its new name. */
export const renameKeys = <T>(
  values: Record<string, T>,
  renames: ReadonlyMap<string, string>,
): Record<string, T> =>
  Object.fromEntries(
    [...renames].flatMap(([oldName, newName]) =>
      Object.hasOwn(values, oldName) ? [[newName, values[oldName]]] : [],
    ),
  );
