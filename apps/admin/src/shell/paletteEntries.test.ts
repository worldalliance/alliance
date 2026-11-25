import { describe, expect, it } from "bun:test";
import { adminSearchResults, SearchKind } from "../lib/adminSearch";
import { PLACES } from "../places";
import { BROWSE_GROUPS, SEARCH_PAGES } from "./paletteEntries";

const find = (query: string) =>
  adminSearchResults({
    query,
    pages: SEARCH_PAGES,
    actions: [],
    suites: [],
    members: [],
    forms: [],
    groups: [],
  });

/** Every label of the sidebar before the redesign, and where that page is now. */
const OLD_SIDEBAR: [label: string, to: string][] = [
  ["Stats", "/"],
  ["Projects", "/tasks/projects"],
  ["Kora participants", "/research"],
  ["Actions", "/tasks?view=list"],
  ["Priority", "/tasks?view=priority"],
  ["Scheduled Plans", "/activity/scheduled"],
  ["Contracts", "/tasks/contracts"],
  ["Formulas", "/tasks/formulas"],
  ["Member lists", "/members/lists"],
  ["Live Invite Feed", "/growth/invites?tab=feed"],
  ["Event Log", "/activity"],
  ["Custom Links", "/growth/links?tab=custom-links"],
  ["Hosted Docs", "/growth/links?tab=hosted-docs"],
  ["Invite Links", "/growth/invites?tab=links"],
  ["User Invites", "/growth/invites"],
  ["Invitation Message", "/growth/invites?tab=template"],
  ["Share Links", "/growth/links"],
  ["Share Targets", "/growth/links?tab=share-targets"],
  ["Entries", "/growth/waitlist"],
  ["Emails", "/growth/waitlist?tab=emails"],
  ["Organizations", "/growth/organizations"],
  ["Members", "/members"],
  ["Needs reply", "/inbox"],
  ["Texts", "/inbox?tab=all"],
  ["Groups", "/members/groups"],
  ["Welcome Queue", "/members/welcome"],
  ["Staff Directory", "/members?tab=staff"],
  ["Member Map", "/members?view=map"],
  ["Away Members", "/members?tab=away"],
  ["Clusters", "/members/clusters"],
  ["Friend Graph", "/members/friends"],
  ["Ambassador Program", "/growth/ambassadors"],
  ["Outreach Partnerships", "/growth/partnerships"],
  ["Action Updates", "/content/task-updates"],
  ["General Updates", "/content/general-updates"],
  ["Forum Posts", "/content/posts"],
  ["Image Upload", "/content/media"],
  ["Videos", "/content/media?tab=videos"],
];

/** The old sidebar's folders, which were never pages, and a page each held. */
const OLD_FOLDERS: [label: string, to: string][] = [
  ["Action Planning", "/tasks"],
  ["Activity", "/activity"],
  ["Links", "/growth/links"],
  ["Waitlist", "/growth/waitlist"],
  ["Community", "/members"],
  ["Outreach", "/growth/partnerships"],
  ["Content", "/content/task-updates"],
];

/** Pages the old sidebar never listed, by the names staff knew them by. */
const OLD_UNLISTED: [label: string, to: string][] = [
  ["Timeline", "/tasks"],
  ["Invite graph", "/growth/invites?tab=graph"],
  ["Test push notification", "/settings"],
  ["Tag management", "/members/tags"],
  ["Suites", "/tasks/suites"],
  ["Forms", "/tasks/forms"],
  ["Kora transcripts", "/research?tab=assignments"],
];

describe("an old page name typed into the palette finds its new place", () => {
  it.each([...OLD_SIDEBAR, ...OLD_UNLISTED])("%s", (label, to) => {
    const [first] = find(label);
    expect(first).toMatchObject({ kind: SearchKind.Page, to });
  });

  it.each(OLD_SIDEBAR)("%s in lower case", (label, to) => {
    expect(find(label.toLowerCase())[0]?.to).toBe(to);
  });

  it.each(OLD_FOLDERS)("the %s folder", (label, to) => {
    expect(find(label).map((result) => result.to)).toContain(to);
  });
});

it("says what a page used to be called when that is how it was found", () => {
  expect(find("scheduled plans")[0]).toMatchObject({
    label: "Scheduled jobs",
    detail: "Was Scheduled plans",
  });
  expect(find("scheduled jobs")[0]).toMatchObject({
    label: "Scheduled jobs",
    detail: "Activity",
  });
});

it("claims no rename for a tab found by its own name or a page by its old folder", () => {
  expect(find("staff")[0]).toMatchObject({
    label: "People › Staff",
    detail: "Members",
  });
  expect(find("community")[0]).toMatchObject({
    label: "People",
    detail: "Members",
  });
});

it("lists a page once when a tab or view shares its URL", () => {
  const found = find("members").map((result) => result.to);
  expect(new Set(found).size).toBe(found.length);
});

it("lists every place once when browsing", () => {
  const browsed = BROWSE_GROUPS.flatMap((group) => group.places);
  expect(browsed).toHaveLength(PLACES.length);
  expect(new Set(browsed)).toEqual(new Set(PLACES));
});
