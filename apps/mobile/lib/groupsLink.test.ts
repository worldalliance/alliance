import { R } from "@alliance/common/result";
import { describe, expect, it } from "bun:test";
import {
  GroupsLinkFailure,
  GroupsRefresh,
  groupsRefresh,
  resolveGroupsLink,
} from "./groupsLink";

const isTab = (value: string | undefined): value is "activity" | "members" =>
  value === "activity" || value === "members";

describe("resolveGroupsLink", () => {
  it("opens the named group on the named tab", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1, 2],
        refresh: GroupsRefresh.Succeeded,
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
        refresh: GroupsRefresh.Succeeded,
        isTab,
        tabParam: "members",
        communityIdParam: undefined,
      }),
    ).toEqual(R.success({ communityId: null, tab: "members" }));
    expect(
      resolveGroupsLink({
        communityIds: [1],
        refresh: GroupsRefresh.Succeeded,
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
        refresh: GroupsRefresh.Succeeded,
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
        refresh: GroupsRefresh.Succeeded,
        isTab,
        tabParam: "members",
        communityIdParam: "9",
      }),
    ).toEqual(R.failure(GroupsLinkFailure.NotMember));
  });

  it("opens a group the stale list holds after a failed refresh", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1],
        refresh: GroupsRefresh.Failed,
        isTab,
        tabParam: "members",
        communityIdParam: "1",
      }),
    ).toEqual(R.success({ communityId: 1, tab: "members" }));
  });

  it("blames the failed refresh for a group the stale list lacks", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1],
        refresh: GroupsRefresh.Failed,
        isTab,
        tabParam: "members",
        communityIdParam: "9",
      }),
    ).toEqual(R.failure(GroupsLinkFailure.RefreshFailed));
  });

  it("waits for the refresh before failing on a group the cached list lacks", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1],
        refresh: GroupsRefresh.Pending,
        isTab,
        tabParam: "members",
        communityIdParam: "9",
      }),
    ).toBeNull();
  });

  it("opens a group the cached list holds before the refresh finishes", () => {
    expect(
      resolveGroupsLink({
        communityIds: [1],
        refresh: GroupsRefresh.Pending,
        isTab,
        tabParam: "members",
        communityIdParam: "1",
      }),
    ).toEqual(R.success({ communityId: 1, tab: "members" }));
  });
});

describe("groupsRefresh", () => {
  it("stays pending until the link's refresh finishes, despite an earlier error", () => {
    expect(
      groupsRefresh({ linkRefreshed: false, isFetching: false, isError: true }),
    ).toBe(GroupsRefresh.Pending);
    expect(
      groupsRefresh({ linkRefreshed: true, isFetching: true, isError: true }),
    ).toBe(GroupsRefresh.Pending);
  });

  it("reports how the finished refresh went", () => {
    expect(
      groupsRefresh({ linkRefreshed: true, isFetching: false, isError: true }),
    ).toBe(GroupsRefresh.Failed);
    expect(
      groupsRefresh({ linkRefreshed: true, isFetching: false, isError: false }),
    ).toBe(GroupsRefresh.Succeeded);
  });
});
