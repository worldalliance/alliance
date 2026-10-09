import { R } from "@alliance/common/result";
import { describe, expect, it } from "bun:test";
import { resolveGroupsLink } from "./groupsLink";

const isTab = (value: string | undefined): value is "activity" | "members" =>
  value === "activity" || value === "members";

describe("resolveGroupsLink", () => {
  it("opens the named group on the named tab", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1, 2],
        isTab,
        tabParam: "members",
        communityIdParam: "2",
      }),
    ).toEqual(R.success({ communityId: 2, tab: "members" }));
  });

  it("applies either param alone", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1],
        isTab,
        tabParam: "members",
        communityIdParam: undefined,
      }),
    ).toEqual(R.success({ communityId: null, tab: "members" }));
    expect(
      resolveGroupsLink({
        communityIds: [1],
        isTab,
        tabParam: undefined,
        communityIdParam: "1",
      }),
    ).toEqual(R.success({ communityId: 1, tab: null }));
  });

  it("ignores an unknown tab", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1],
        isTab,
        tabParam: "bogus",
        communityIdParam: "1",
      }),
    ).toEqual(R.success({ communityId: 1, tab: null }));
  });

  it("fails on a group the member isn't in", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1],
        isTab,
        tabParam: "members",
        communityIdParam: "9",
      }),
    ).toEqual(R.failure({ communityIdParam: "9" }));
  });
});
