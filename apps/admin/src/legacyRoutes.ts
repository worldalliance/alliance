import { generatePath, matchRoutes } from "react-router";
import { FORUM_POST_PATH, PLACES, RECORDS } from "./places";

export type LegacyRoute = {
  /** A route pattern of the admin before the redesign. */
  from: string;
  to: string;
  /** Set on the new URL: the tab or view the old page became. */
  search?: Readonly<Record<string, string>>;
  /** The old page's own params take this prefix, as its new home namespaces them. */
  searchPrefix?: string;
};

/**
 * Every old URL that moved. Old routes missing here (`/`, `/members`,
 * `/members/tags`, `/login`) kept their path.
 */
export const LEGACY_ROUTES: readonly LegacyRoute[] = [
  { from: "/needs-reply", to: "/inbox" },
  { from: "/texts", to: "/inbox", search: { tab: "all" } },
  { from: "/texts/:threadId", to: "/inbox/:threadId" },

  { from: "/actions", to: "/tasks", search: { view: "list" } },
  { from: "/timeline", to: "/tasks" },
  { from: "/priority", to: "/tasks", search: { view: "priority" } },
  { from: "/actions/:actionId", to: "/tasks/:actionId" },
  {
    from: "/actions/:actionId/updates/:updateId",
    to: "/tasks/:actionId/updates/:updateId",
  },
  {
    from: "/projects/:projectId/action/:actionId",
    to: "/tasks/projects/:projectId/tasks/:actionId",
  },
  { from: "/new-suite", to: "/tasks/suites/new" },
  { from: "/suites/:suiteId", to: "/tasks/suites/:suiteId" },
  {
    from: "/suites/:suiteId/launch",
    to: "/tasks/suites/:suiteId",
    search: { tab: "launch" },
  },
  { from: "/projects", to: "/tasks/projects" },
  { from: "/projects/:projectId", to: "/tasks/projects/:projectId" },
  { from: "/forms", to: "/tasks/forms" },
  { from: "/forms/:formId", to: "/tasks/forms/:formId" },
  {
    from: "/forms/:formId/responses",
    to: "/tasks/forms/:formId",
    search: { tab: "responses" },
    searchPrefix: "resp_",
  },
  {
    from: "/forms/:formId/snapshots",
    to: "/tasks/forms/:formId",
    search: { tab: "versions" },
  },
  { from: "/formulas", to: "/tasks/formulas" },
  { from: "/formulas/:formulaId", to: "/tasks/formulas/:formulaId" },
  { from: "/contracts", to: "/tasks/contracts" },
  { from: "/contracts/:id", to: "/tasks/contracts/:id" },

  { from: "/member/:userId", to: "/members/:userId" },
  { from: "/staff-directory", to: "/members", search: { tab: "staff" } },
  { from: "/away", to: "/members", search: { tab: "away" } },
  { from: "/member-map", to: "/members", search: { view: "map" } },
  { from: "/welcome-queue", to: "/members/welcome" },
  { from: "/groups", to: "/members/groups" },
  { from: "/groups/:id", to: "/members/groups/:id" },
  { from: "/clusters", to: "/members/clusters" },
  { from: "/member-lists", to: "/members/lists" },
  { from: "/member-lists/:listId", to: "/members/lists/:listId" },
  { from: "/friend-graph", to: "/members/friends" },

  { from: "/invites", to: "/growth/invites" },
  { from: "/invite-links", to: "/growth/invites", search: { tab: "links" } },
  { from: "/invites/graph", to: "/growth/invites", search: { tab: "graph" } },
  { from: "/invite-feed", to: "/growth/invites", search: { tab: "feed" } },
  {
    from: "/invite-message-template",
    to: "/growth/invites",
    search: { tab: "template" },
  },
  { from: "/waitlist", to: "/growth/waitlist" },
  {
    from: "/waitlist-emails",
    to: "/growth/waitlist",
    search: { tab: "emails" },
  },
  { from: "/share-links", to: "/growth/links" },
  {
    from: "/custom-links",
    to: "/growth/links",
    search: { tab: "custom-links" },
  },
  {
    from: "/share-targets",
    to: "/growth/links",
    search: { tab: "share-targets" },
  },
  { from: "/hosted-docs", to: "/growth/links", search: { tab: "hosted-docs" } },
  { from: "/organizations", to: "/growth/organizations" },
  { from: "/outreach-partnerships", to: "/growth/partnerships" },
  { from: "/ambassador-program", to: "/growth/ambassadors" },

  { from: "/action-updates", to: "/content/task-updates" },
  { from: "/general-updates", to: "/content/general-updates" },
  { from: "/general-updates/:id", to: "/content/general-updates/:id" },
  { from: "/posts/:postId?", to: FORUM_POST_PATH },
  { from: "/image", to: "/content/media" },
  { from: "/videos", to: "/content/media", search: { tab: "videos" } },
  { from: "/videos/:videoId", to: "/content/media/videos/:videoId" },

  { from: "/event-log", to: "/activity" },
  { from: "/scheduled", to: "/activity/scheduled" },

  { from: "/kora-participants", to: "/research" },
  {
    from: "/kora-participants/assignments/:assignmentId",
    to: "/research/assignments/:assignmentId",
  },
  {
    from: "/kora-participants/preview/:batchId",
    to: "/research/preview/:batchId",
  },

  { from: "/test-push", to: "/settings" },
];

export type RedirectTarget = { pathname: string; search: string; hash: string };

/** Where an old URL lives now, its query and hash kept; null if it never moved. */
export const legacyRedirect = (location: {
  pathname: string;
  search: string;
  hash: string;
}): RedirectTarget | null => {
  for (const legacy of LEGACY_ROUTES) {
    // matchRoutes decodes the params generatePath encodes; matchPath doesn't.
    const match = matchRoutes([{ path: legacy.from }], location.pathname)?.[0];
    if (!match) continue;
    const search = new URLSearchParams(legacy.search);
    for (const [name, value] of new URLSearchParams(location.search)) {
      search.append(`${legacy.searchPrefix ?? ""}${name}`, value);
    }
    const query = search.toString();
    return {
      pathname: generatePath(legacy.to, match.params),
      search: query ? `?${query}` : "",
      hash: location.hash,
    };
  }
  return null;
};

const targetRoutes = [
  ...new Set([
    ...LEGACY_ROUTES.map((legacy) => legacy.to),
    ...PLACES.map((place) => place.path),
    ...RECORDS.map((record) => record.path),
  ]),
].map((path) => ({ path }));

/**
 * The path this page had before the redesign, which is the path the member
 * site's link table still knows the admin by.
 */
export const legacyPathFor = ({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}): string => {
  const pattern = matchRoutes(targetRoutes, pathname)?.at(-1);
  const params = new URLSearchParams(search);
  const here = LEGACY_ROUTES.filter(
    (legacy) => legacy.to === pattern?.route.path,
  );
  // An old page that became a tab or view shares its path with the page it joined.
  const legacy =
    here.find(
      (candidate) =>
        candidate.search &&
        Object.entries(candidate.search).every(
          ([name, value]) => params.get(name) === value,
        ),
    ) ?? here.find((candidate) => !candidate.search);
  return legacy && pattern
    ? generatePath(legacy.from, pattern.params)
    : pathname;
};
