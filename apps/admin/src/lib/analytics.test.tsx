import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import posthog, { type CaptureResult } from "posthog-js";
import { createContext, useContext } from "react";
import { createMemoryRouter, matchRoutes, RouterProvider } from "react-router";
import {
  beforeSend,
  routeTemplate,
  scrubEvent,
  scrubLocation,
  syncStaff,
  useAnalytics,
} from "./analytics";

const origin = "https://admin.example.org";
const templates = new Map([
  ["/forms/42", "/forms/:formId"],
  ["/projects/7/action/9", "/projects/:projectId/action/:actionId"],
]);
const params = { origin, templates };
const staff = { id: 7, email: "staff@example.org", name: "Staff" };
const admin = { ...staff, admin: true };
const calls: string[] = [];
let state = { userState: "anonymous", distinctId: "anon-uuid" };

beforeEach(() => {
  calls.splice(0);
  state = { userState: "anonymous", distinctId: "anon-uuid" };
  spyOn(posthog, "get_property").mockImplementation(() => state.userState);
  spyOn(posthog, "get_distinct_id").mockImplementation(() => state.distinctId);
  spyOn(posthog, "reset").mockImplementation(() => calls.push("reset"));
  spyOn(posthog, "register").mockImplementation(() => calls.push("register"));
  spyOn(posthog, "identify").mockImplementation((id) =>
    calls.push(`identify ${id}`),
  );
});

describe("beforeSend", () => {
  it("drops events until a staff member is identified, then scrubs them", () => {
    const event: CaptureResult = {
      uuid: "u",
      event: "$pageleave",
      properties: { $referrer: "https://example.org/member/5" },
    };
    syncStaff(undefined);
    expect(beforeSend(event)).toBeNull();
    syncStaff(staff);
    expect(beforeSend(event)?.properties).toEqual({
      $referrer: "https://example.org",
    });
  });
});

describe("routeTemplate", () => {
  const routes = [
    { path: "/forms/:formId" },
    { path: "/projects/:projectId/action/:actionId" },
    { path: "/members" },
    { path: "/" },
  ];
  const templateOf = (url: string) => {
    const leaf = matchRoutes(routes, url)?.at(-1);
    if (!leaf) throw new Error(`no route matches ${url}`);
    return routeTemplate(leaf);
  };

  it("replaces each param value with its name", () => {
    expect(templateOf("/projects/7/action/9")).toBe(
      "/projects/:projectId/action/:actionId",
    );
  });

  it.each([
    "/forms/a%20b",
    "/forms/a%2520b",
    "/forms/a%2Fb",
    "/forms/%E0%A4%A",
  ])("replaces the encoded param in %s", (url) => {
    expect(templateOf(url)).toBe("/forms/:formId");
  });

  it("names each segment by its own param when two params share a value", () => {
    expect(templateOf("/projects/3/action/3")).toBe(
      "/projects/:projectId/action/:actionId",
    );
  });

  it("reports a param no segment holds as unknown", () => {
    expect(
      routeTemplate({ pathname: "/files/a/b", params: { "*": "a/b" } }),
    ).toBe("/[unknown]");
  });

  it("leaves a path without params as it is", () => {
    expect(templateOf("/members")).toBe("/members");
    expect(templateOf("/")).toBe("/");
  });

  it.each(["/members/", "/MEMBERS", "/Forms/A1/"])(
    "groups %s with its route's spelling",
    (url) => {
      expect(templateOf(url)).toBe(
        url.toLowerCase().startsWith("/forms") ? "/forms/:formId" : "/members",
      );
    },
  );
});

describe("scrubLocation", () => {
  it("swaps an admin URL's path for its template and drops the query and hash", () => {
    expect(scrubLocation(`${origin}/forms/42?search=Ada#q`, params)).toBe(
      `${origin}/forms/:formId`,
    );
  });

  it("swaps a bare path for its template", () => {
    expect(scrubLocation("/forms/42", params)).toBe("/forms/:formId");
  });

  it("reports a path no route rendered as unknown", () => {
    expect(scrubLocation(`${origin}/member/123`, params)).toBe(
      `${origin}/[unknown]`,
    );
  });

  it("keeps only the origin of another site's URL", () => {
    expect(scrubLocation("https://example.org/member/123?x=1", params)).toBe(
      "https://example.org",
    );
  });

  it.each(["$direct", "http://[bad"])(
    "leaves %s, which isn't a location, alone",
    (value) => {
      expect(scrubLocation(value, params)).toBe(value);
    },
  );
});

describe("scrubEvent", () => {
  it("scrubs URL, path and referrer properties in properties, $set and $set_once, and drops the title and query-derived properties", () => {
    const event: CaptureResult = {
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: `${origin}/forms/42?search=Ada`,
        $pathname: "/forms/42",
        $prev_pageview_pathname: "/projects/7/action/9",
        $referrer: "https://example.org/member/5",
        $session_entry_url: `${origin}/forms/42`,
        $host: "admin.example.org",
        title: "Ada Lovelace - Texts - Admin",
        utm_term: "Ada",
        gclid: "click-id",
        ph_keyword: "Ada Lovelace",
        $session_entry_utm_term: "Ada",
        app: "admin",
      },
      $set: { $current_url: `${origin}/forms/42` },
      $set_once: {
        $initial_pathname: "/forms/42",
        $initial_referrer: "$direct",
        $initial_utm_term: "Ada",
      },
    };

    expect(scrubEvent(event, params)).toEqual({
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: `${origin}/forms/:formId`,
        $pathname: "/forms/:formId",
        $prev_pageview_pathname: "/projects/:projectId/action/:actionId",
        $referrer: "https://example.org",
        $session_entry_url: `${origin}/forms/:formId`,
        $host: "admin.example.org",
        app: "admin",
      },
      $set: { $current_url: `${origin}/forms/:formId` },
      $set_once: {
        $initial_pathname: "/forms/:formId",
        $initial_referrer: "$direct",
      },
    });
  });

  it("drops every campaign parameter the installed posthog-js copies from the query string", async () => {
    const bundle = await Bun.file(
      Bun.resolveSync("posthog-js/dist/module.js", import.meta.dir),
    ).text();
    const lists = bundle.match(/\[[^[\]]*"(?:gclid|utm_source)"[^[\]]*\]/g);
    const names = lists?.flatMap((list) =>
      [...list.matchAll(/"([^"]+)"/g)].map(([, name]) => name),
    );
    expect(names).toContain("gclid");
    expect(names).toContain("utm_source");
    const properties = Object.fromEntries(
      (names ?? []).map((name) => [name, "value"]),
    );
    const event = { uuid: "u", event: "$pageview", properties };

    expect(scrubEvent(event, params).properties).toEqual({});
  });
});

describe("syncStaff", () => {
  it("identifies staff in an anonymous browser", () => {
    syncStaff(staff);
    expect(calls).toEqual(["identify 7"]);
  });

  it("resets a browser identified as someone else before identifying", () => {
    state = { userState: "identified", distinctId: "8" };
    syncStaff(staff);
    expect(calls).toEqual(["reset", "register", "identify 7"]);
  });

  it("keeps the identity of the same staff member", () => {
    state = { userState: "identified", distinctId: "7" };
    syncStaff(staff);
    expect(calls).toEqual(["identify 7"]);
  });

  it("resets an identified browser with no signed-in staff", () => {
    state = { userState: "identified", distinctId: "7" };
    syncStaff(undefined);
    expect(calls).toEqual(["reset", "register"]);
  });

  it("leaves an anonymous browser with no signed-in staff alone", () => {
    syncStaff(undefined);
    expect(calls).toEqual([]);
  });
});

describe("useAnalytics", () => {
  type Session = Parameters<typeof useAnalytics>[0];
  const SessionContext = createContext<Session>({
    user: undefined,
    isImpersonation: false,
    loading: true,
  });
  function Page() {
    useAnalytics(useContext(SessionContext));
    return null;
  }

  beforeEach(() => {
    syncStaff(undefined);
    calls.splice(0);
    posthog.__loaded = true;
    // The scrubbed path shows the template was recorded before the capture.
    spyOn(posthog, "capture").mockImplementation((event) => {
      const sent = beforeSend({
        uuid: "u",
        event,
        properties: { $pathname: window.location.pathname },
      });
      calls.push(`${event} ${sent ? sent.properties.$pathname : "dropped"}`);
      return undefined;
    });
  });
  afterEach(() => {
    posthog.__loaded = false;
    window.happyDOM.setURL("about:blank");
  });

  const renderAt = (path: string) => {
    window.happyDOM.setURL(`${origin}${path}`);
    const router = createMemoryRouter(
      [
        { path: "/forms/:formId", Component: Page },
        { path: "/members", Component: Page },
      ],
      { initialEntries: [path] },
    );
    const view = (session: Session) => (
      <SessionContext.Provider value={session}>
        <RouterProvider router={router} />
      </SessionContext.Provider>
    );
    const { rerender } = render(
      view({ user: undefined, isImpersonation: false, loading: true }),
    );
    return {
      settle: (session: Session) => act(() => rerender(view(session))),
      navigate: async (to: string) => {
        window.happyDOM.setURL(`${origin}${to}`);
        await act(() => router.navigate(to));
      },
    };
  };

  it("sends a page view per route once the staff member is known", async () => {
    const page = renderAt("/forms/42");
    expect(calls).toEqual([]);

    page.settle({ user: admin, isImpersonation: false, loading: false });
    expect(calls).toEqual(["identify 7", "$pageview /forms/:formId"]);

    await page.navigate("/members");
    expect(calls.at(-1)).toBe("$pageview /members");
  });

  it("keeps the identity when the staff member signs out on the page", () => {
    state = { userState: "identified", distinctId: "7" };
    const page = renderAt("/members");
    page.settle({ user: admin, isImpersonation: false, loading: false });
    calls.splice(0);

    page.settle({ user: undefined, isImpersonation: false, loading: false });
    expect(calls).toEqual([]);
  });

  it.each([
    ["no one is signed in", { user: undefined, isImpersonation: false }],
    [
      "a member who isn't an admin",
      { user: { ...staff, admin: false }, isImpersonation: false },
    ],
    ["an admin is impersonated", { user: admin, isImpersonation: true }],
  ])("sends nothing when %s", (_, session) => {
    state = { userState: "identified", distinctId: "7" };
    const page = renderAt("/members");
    page.settle({ ...session, loading: false });
    expect(calls).toEqual(["reset", "register", "$pageview dropped"]);
  });
});
