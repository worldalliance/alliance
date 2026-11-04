/** A record whose fields come from the newest response, except that each
 * group's fields come from the newest response that carries the group, or
 * from the newest response while none has. A response that leaves a group out
 * sends placeholders for its fields. */
export type Owned<T, G extends string> = {
  value: T;
  revision: number;
  groupRevisions: Partial<Record<G, number>>;
};

/** Returns undefined when `incoming` is older than everything it carries. */
export function mergeOwned<T, G extends string>(params: {
  current: Owned<T, G> | undefined;
  incoming: T;
  revision: number;
  carries: readonly G[];
  groups: Record<G, readonly (keyof T)[]>;
}): Owned<T, G> | undefined {
  const { current, incoming, revision, carries, groups } = params;
  const newerGroups = carries.filter(
    (group) => revision > (current?.groupRevisions[group] ?? 0),
  );
  const groupRevisions: Partial<Record<G, number>> = {
    ...current?.groupRevisions,
  };
  for (const group of newerGroups) groupRevisions[group] = revision;
  if (!current) return { value: incoming, revision, groupRevisions };
  const newer = revision > current.revision;
  if (!newer && newerGroups.length === 0) return undefined;
  const base = newer ? incoming : current.value;
  const value = { ...base };
  // A Record<G, …> has exactly the keys G.
  for (const group of Object.keys(groups) as G[]) {
    const owner = newerGroups.includes(group)
      ? incoming
      : current.groupRevisions[group] === undefined
        ? base
        : current.value;
    for (const field of groups[group]) value[field] = owner[field];
  }
  return {
    value,
    revision: newer ? revision : current.revision,
    groupRevisions,
  };
}
