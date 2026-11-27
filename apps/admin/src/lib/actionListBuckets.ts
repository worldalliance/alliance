import { ActionStatusBucket } from "./actionStatusBucket";
import { readSetParam, writeSetParam } from "./setSearchParam";

const BUCKETS = Object.values(ActionStatusBucket);

const DEFAULT_BUCKETS: readonly ActionStatusBucket[] = [
  ActionStatusBucket.Active,
  ActionStatusBucket.Pending,
  ActionStatusBucket.Draft,
];

/** The buckets a `status` search param selects; the defaults when it is absent. */
export const readBuckets = (param: string | null): Set<ActionStatusBucket> =>
  readSetParam({ param, values: BUCKETS, defaults: DEFAULT_BUCKETS });

/** The `status` search param for `buckets`, or null for the defaults. */
export const writeBuckets = (buckets: ReadonlySet<string>): string | null =>
  writeSetParam({
    selected: buckets,
    values: BUCKETS,
    defaults: DEFAULT_BUCKETS,
  });
