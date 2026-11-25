import type { RouteConfigEntry } from "@react-router/dev/routes";
import { expect, test } from "bun:test";
import { matchPath, matchRoutes } from "react-router";
import { LEGACY_ROUTES, legacyPathFor, legacyRedirect } from "./legacyRoutes";
import { FORUM_POST_PATH, PLACES, RECORDS } from "./places";
import routes from "./routes";

/** Every route of the admin before the redesign, from `routes.ts` at c722280863. */
const OLD_ROUTES = [
  "/invite-feed",
  "/kora-participants/preview/:batchId",
  "/projects",
  "/projects/:projectId",
  "/kora-participants",
  "/kora-participants/assignments/:assignmentId",
  "/projects/:projectId/action/:actionId",
  "/actions",
  "/timeline",
  "/invite-links",
  "/invites",
  "/invites/graph",
  "/friend-graph",
  "/groups",
  "/groups/:id",
  "/clusters",
  "/actions/:actionId",
  "/actions/:actionId/updates/:updateId",
  "/scheduled",
  "/suites/:suiteId",
  "/suites/:suiteId/launch",
  "/new-suite",
  "/",
  "/forms",
  "/formulas",
  "/formulas/:formulaId",
  "/member-lists",
  "/member-lists/:listId",
  "/forms/:formId/responses",
  "/forms/:formId/snapshots",
  "/forms/:formId",
  "/members/tags",
  "/member/:userId",
  "/test-push",
  "/members",
  "/needs-reply",
  "/texts",
  "/texts/:threadId",
  "/image",
  "/videos",
  "/videos/:videoId",
  "/posts/:postId?",
  "/event-log",
  "/welcome-queue",
  "/action-updates",
  "/general-updates",
  "/general-updates/:id",
  "/contracts",
  "/contracts/:id",
  "/ambassador-program",
  "/outreach-partnerships",
  "/share-targets",
  "/share-links",
  "/custom-links",
  "/hosted-docs",
  "/organizations",
  "/waitlist",
  "/waitlist-emails",
  "/invite-message-template",
  "/priority",
  "/staff-directory",
  "/member-map",
  "/away",
  "/login",
];

type Leaf = { path: string; file: string };

const joined = (parent: string, path: string) =>
  path.startsWith("/") ? path : `${parent}/${path}`;

const leaves = (entries: RouteConfigEntry[], parent = ""): Leaf[] =>
  entries.flatMap((entry) => {
    const path = entry.path === undefined ? parent : joined(parent, entry.path);
    return [
      ...(entry.path ? [{ path, file: entry.file }] : []),
      ...leaves(entry.children ?? [], path),
    ];
  });

const REDIRECT_FILE = "shell/LegacyRedirect.tsx";
const all = leaves(routes);
const pages = all.filter((leaf) => leaf.file !== REDIRECT_FILE);
const pageRoutes = pages.map(({ path }) => ({ path }));
const everyRoute = all.map(({ path, file }) => ({ path, id: file + path }));

/** A URL the pattern matches: `7` for each param, an optional one filled in. */
const sample = (pattern: string) => pattern.replace(/:\w+\??/g, "7");

const routedFile = (pathname: string) => {
  const matched = matchRoutes(everyRoute, pathname)?.at(-1)?.route.path;
  return all.find((leaf) => leaf.path === matched)?.file;
};

test("the old admin had 64 routes", () => {
  expect(new Set(OLD_ROUTES).size).toBe(64);
});

test.each(OLD_ROUTES)("%s still opens a page", (oldRoute) => {
  const pathname = sample(oldRoute);
  if (routedFile(pathname) !== REDIRECT_FILE) {
    expect(matchRoutes(pageRoutes, pathname)).not.toBeNull();
    return;
  }
  const target = legacyRedirect({
    pathname,
    search: "?q=kept&tab=theirs",
    hash: "#kept",
  });
  expect(target).not.toBeNull();
  expect(routedFile(target!.pathname)).not.toBe(REDIRECT_FILE);
  expect(matchRoutes(pageRoutes, target!.pathname)).not.toBeNull();
  expect(target!.hash).toBe("#kept");
  const search = new URLSearchParams(target!.search);
  expect([search.get("q"), search.get("resp_q")]).toContain("kept");
});

test("an optional param left out redirects without it", () => {
  expect(legacyRedirect({ pathname: "/posts", search: "", hash: "" })).toEqual({
    pathname: "/content/posts",
    search: "",
    hash: "",
  });
});

test("a param with an encoded character is encoded once", () => {
  expect(
    legacyRedirect({ pathname: "/texts/a%20b", search: "", hash: "" })
      ?.pathname,
  ).toBe("/inbox/a%20b");
});

test("an old page that became a tab lands on that tab", () => {
  expect(
    legacyRedirect({ pathname: "/texts", search: "?page=2", hash: "" }),
  ).toEqual({ pathname: "/inbox", search: "?tab=all&page=2", hash: "" });
  expect(
    legacyRedirect({ pathname: "/suites/3/launch", search: "", hash: "" })
      ?.search,
  ).toBe("?tab=launch");
});

test("form responses keep their own params beside the form's tab", () => {
  expect(
    legacyRedirect({
      pathname: "/forms/5/responses",
      search: "?tab=replays&filterField=a",
      hash: "",
    }),
  ).toEqual({
    pathname: "/tasks/forms/5",
    search: "?tab=responses&resp_tab=replays&resp_filterField=a",
    hash: "",
  });
});

test("every redirect has a route, and every redirect route a target", () => {
  const redirectPaths = all
    .filter((leaf) => leaf.file === REDIRECT_FILE)
    .map((leaf) => leaf.path);
  expect(redirectPaths.sort()).toEqual(
    LEGACY_ROUTES.map((legacy) => legacy.from).sort(),
  );
});

test("no new route is shadowed by an old one", () => {
  for (const page of pages) {
    expect(routedFile(sample(page.path))).not.toBe(REDIRECT_FILE);
  }
});

test("every place and record in the page map has a route, and the reverse", () => {
  const mapped = [
    ...PLACES.map((place) => place.path),
    ...RECORDS.map((record) => record.path),
    FORUM_POST_PATH,
  ];
  expect(
    pages
      .map((page) => page.path)
      .filter((path) => path !== "/login" && path !== "/content/posts")
      .sort(),
  ).toEqual(mapped.filter((path) => path !== "/content/posts").sort());
  for (const record of RECORDS.filter((record) => record.fullScreen)) {
    expect(matchPath(record.path, sample(record.path))).not.toBeNull();
  }
});

test("a page's old path is found from its new one", () => {
  const from = (pathname: string, search = "") =>
    legacyPathFor({ pathname, search });
  expect(from("/tasks/4")).toBe("/actions/4");
  expect(from("/tasks/suites/4")).toBe("/suites/4");
  expect(from("/content/posts/4")).toBe("/posts/4");
  expect(from("/members/9")).toBe("/member/9");
  expect(from("/members")).toBe("/members");
  expect(from("/tasks")).toBe("/timeline");
  expect(from("/tasks", "?view=list&q=recall")).toBe("/actions");
  expect(from("/members", "?tab=staff")).toBe("/staff-directory");
});
