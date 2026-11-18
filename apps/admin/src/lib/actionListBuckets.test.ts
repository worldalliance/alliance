import { describe, expect, it } from "bun:test";
import { readBuckets, writeBuckets } from "./actionListBuckets";
import { ActionStatusBucket } from "./actionStatusBucket";

describe("action list status buckets in the URL", () => {
  it("defaults to active, pending and draft without a param", () => {
    expect([...readBuckets(null)]).toEqual([
      ActionStatusBucket.Active,
      ActionStatusBucket.Pending,
      ActionStatusBucket.Draft,
    ]);
  });

  it("leaves the param out for the defaults, in any order", () => {
    expect(
      writeBuckets(
        new Set([
          ActionStatusBucket.Draft,
          ActionStatusBucket.Active,
          ActionStatusBucket.Pending,
        ]),
      ),
    ).toBeNull();
  });

  it("round-trips another selection, an empty one included", () => {
    const completed = new Set([ActionStatusBucket.Completed]);
    expect(readBuckets(writeBuckets(completed))).toEqual(completed);
    expect(readBuckets(writeBuckets(new Set()))).toEqual(new Set());
  });

  it("ignores names that aren't buckets", () => {
    expect(readBuckets("completed,bogus")).toEqual(
      new Set([ActionStatusBucket.Completed]),
    );
  });
});
