import { describe, expect, it } from "bun:test";
import { INITIAL_WAITLIST_FILTER } from "../../lib/waitlistFilter";
import {
  filterFromParams,
  pageFromParams,
  sortFromParams,
  withFilterParams,
  withPageParam,
  withSortParam,
} from "./waitlistUrl";

const params = (query: string) => new URLSearchParams(query);

describe("filterFromParams", () => {
  it("hides spam-like entries when the URL names no spam filter", () => {
    expect(filterFromParams(params(""))).toEqual(INITIAL_WAITLIST_FILTER);
  });

  it("drops unknown values as if they weren't there", () => {
    expect(
      filterFromParams(
        params("org=7,x,-1&invite=unused,bogus&contact=fax&mobilized=maybe"),
      ),
    ).toEqual({
      ...INITIAL_WAITLIST_FILTER,
      organizationIds: [7],
      inviteStates: ["unused"],
    });
  });

  it("drops names that only an object's prototype has", () => {
    expect(
      filterFromParams(
        params("invite=toString&spam=__proto__,constructor&contact=valueOf"),
      ),
    ).toEqual({});
    expect(sortFromParams(params("sort=constructor"))).toBe("joined_desc");
  });
});

describe("withFilterParams", () => {
  it("round-trips every field and keeps the tab", () => {
    const filter = {
      search: "pat",
      organizationIds: [7, 8],
      sourceLinkIds: [9],
      referrerIds: [1],
      tagIds: [5],
      inviteStates: ["unused" as const, "claimed" as const],
      spamStatuses: ["spam" as const],
      contactMethod: "phone" as const,
      mobilized: false,
      subscribed: true,
      hasReason: true,
      joinedFrom: new Date("2026-09-01T00:00").toISOString(),
      joinedBefore: new Date("2026-09-11T00:00").toISOString(),
    };
    const next = withFilterParams(params("tab=emails&page=3"), filter);
    expect(next.get("tab")).toBe("emails");
    expect(next.get("page")).toBeNull();
    expect(next.get("from")).toBe("2026-09-01");
    expect(next.get("to")).toBe("2026-09-10");
    expect(filterFromParams(next)).toEqual(filter);
  });

  it("keeps the default spam filter out of the URL, and says when there is none", () => {
    expect(
      withFilterParams(params(""), INITIAL_WAITLIST_FILTER).toString(),
    ).toBe("");
    const any = withFilterParams(params(""), {});
    expect(any.get("spam")).toBe("any");
    expect(filterFromParams(any)).toEqual({});
  });
});

describe("sort and page", () => {
  it("leaves defaults out, resets the page on a sort, and ignores junk", () => {
    expect(withSortParam(params("page=2"), "joined_desc").toString()).toBe("");
    expect(sortFromParams(withSortParam(params(""), "organization_asc"))).toBe(
      "organization_asc",
    );
    expect(sortFromParams(params("sort=nope"))).toBe("joined_desc");
    expect(withPageParam(params(""), 1).toString()).toBe("");
    expect(pageFromParams(withPageParam(params(""), 3))).toBe(3);
    expect(pageFromParams(params("page=-2"))).toBe(1);
  });
});
