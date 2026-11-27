import { ActionStatusBucket } from "./actionStatusBucket";

const DEFAULT_BUCKETS: readonly ActionStatusBucket[] = [
  ActionStatusBucket.Active,
  ActionStatusBucket.Pending,
  ActionStatusBucket.Draft,
];

const isBucket = (value: string): value is ActionStatusBucket =>
  Object.values<string>(ActionStatusBucket).includes(value);

/** The buckets a `status` search param selects; the defaults when it is absent. */
export function readBuckets(param: string | null): Set<ActionStatusBucket> {
  if (param === null) return new Set(DEFAULT_BUCKETS);
  return new Set(param.split(",").filter(isBucket));
}

/** The `status` search param for `buckets`, or null for the defaults. */
export function writeBuckets(buckets: ReadonlySet<string>): string | null {
  const ordered = Object.values(ActionStatusBucket).filter((bucket) =>
    buckets.has(bucket),
  );
  const isDefault =
    ordered.length === DEFAULT_BUCKETS.length &&
    DEFAULT_BUCKETS.every((bucket) => buckets.has(bucket));
  return isDefault ? null : ordered.join(",");
}
