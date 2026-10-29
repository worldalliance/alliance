import { describe, expect, it } from "bun:test";
import { adminSearchResults, SearchKind } from "./adminSearch";

const lists = {
  pages: [
    { label: "Event Log", folder: "Activity", to: "/event-log" },
    { label: "Members", folder: null, to: "/members" },
  ],
  actions: [
    { id: 4, name: "Call your senator", archived: false },
    {
      id: 12,
      name: "Recall petition",
      archived: true,
      suite: { id: 3, name: "Spring calls" },
    },
  ],
  suites: [{ id: 3, name: "Spring calls" }],
  members: [
    {
      id: 10,
      name: "Ana Lee",
      email: "ana@example.org",
      phoneNumber: "+1 555 010 2000",
    },
  ],
  forms: [
    { id: 5, title: "Call script", usedInAction: { id: 4, name: "Call" } },
  ],
  groups: [{ id: 7, name: "Call center" }],
};

const search = (query: string) =>
  adminSearchResults({ query, ...lists }).map(({ kind, label, to }) => ({
    kind,
    label,
    to,
  }));

describe("adminSearchResults", () => {
  it("finds every kind by name, names starting with the query first", () => {
    expect(search("call")).toEqual([
      { kind: SearchKind.Action, label: "Call your senator", to: "/actions/4" },
      { kind: SearchKind.Action, label: "Recall petition", to: "/actions/12" },
      { kind: SearchKind.Suite, label: "Spring calls", to: "/suites/3" },
      { kind: SearchKind.Form, label: "Call script", to: "/forms/5" },
      { kind: SearchKind.Group, label: "Call center", to: "/groups/7" },
    ]);
  });

  it("finds pages inside folders and members by email or phone", () => {
    expect(search("log")).toEqual([
      { kind: SearchKind.Page, label: "Event Log", to: "/event-log" },
    ]);
    expect(search("ana@")).toEqual([
      { kind: SearchKind.Member, label: "Ana Lee", to: "/member/10" },
    ]);
    expect(search("5550102000")).toEqual([
      { kind: SearchKind.Member, label: "Ana Lee", to: "/member/10" },
    ]);
  });

  it("tells same-named actions apart by suite, and marks archived ones", () => {
    expect(
      adminSearchResults({ query: "recall", ...lists }).map((r) => r.detail),
    ).toEqual(["Spring calls · Archived"]);
  });

  it("finds anything by its exact id", () => {
    expect(search("12")).toEqual([
      { kind: SearchKind.Action, label: "Recall petition", to: "/actions/12" },
    ]);
  });

  it("finds nothing for a blank query", () => {
    expect(search("  ")).toEqual([]);
  });
});
