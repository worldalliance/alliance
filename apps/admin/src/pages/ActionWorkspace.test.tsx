import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../components/LeaveGuard";
import { makeParsedAction } from "../lib/testing/parsedAction";
import ActionWorkspace from "./ActionWorkspace";
import ProjectActionRedirect from "./ProjectActionRedirect";

const project = { id: 3, name: "Housing", category: [] };
const action = makeParsedAction({ id: 7, name: "Call your rep", project });
const memberActionIn = (days: number) => [
  makeEvent({ date: new Date(Date.now() + days * 86_400_000).toISOString() }),
];
const actions = [
  action,
  makeParsedAction({ id: 11, project, staffPreview: true }),
  makeParsedAction({ id: 12, project, events: memberActionIn(7) }),
  makeParsedAction({
    id: 17,
    project,
    events: memberActionIn(7),
    suite: {
      id: 5,
      name: "Spring",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      events: [],
    },
  }),
  makeParsedAction({ id: 13, project, events: memberActionIn(-7) }),
  makeParsedAction({ id: 14, project: null }),
  makeParsedAction({ id: 18, project: null, status: "office_action" }),
  makeParsedAction({
    id: 15,
    project,
    status: "abandoned",
    staffPreview: true,
  }),
  makeParsedAction({
    id: 16,
    project,
    status: "abandoned",
    staffPreview: true,
    events: [
      ...memberActionIn(-14),
      makeEvent({
        id: 2,
        newStatus: "completed",
        date: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      }),
    ],
  }),
];

const notServed = () =>
  Response.json({ message: "Not served" }, { status: 404 });

serveApi(
  routes(
    {
      "GET /actions/adminslug/:id": ({ params }) => {
        const served = actions.find(({ id }) => String(id) === params.id);
        return served
          ? Response.json(served)
          : Response.json({ message: "Server error" }, { status: 500 });
      },
      "GET /actions/suite/:id": () =>
        Response.json({
          id: 5,
          name: "Spring",
          actions: [],
          events: memberActionIn(7),
          reminderGroups: [],
          generalUpdates: [],
        }),
      "GET /projects/:id": () =>
        Response.json({
          id: 3,
          name: "Housing",
          category: [],
          slug: "housing",
          steps: [6, 7, 8].map((actionId) => ({
            actionId,
            actionName: `Step ${actionId}`,
            memberActionAt: null,
          })),
        }),
    },
    notServed,
  ),
);

const renderAt = (url: string) => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <ToastProvider>
            <LeaveGuard>
              <Outlet />
            </LeaveGuard>
          </ToastProvider>
        ),
        children: [
          { path: "/actions/:actionId", element: <ActionWorkspace /> },
          {
            path: "/projects/:projectId/action/:actionId",
            element: <ProjectActionRedirect />,
          },
        ],
      },
    ],
    { initialEntries: [url] },
  );
  render(<RouterProvider router={router} />, queryWrapper());
  return router;
};

const openMenu = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  return screen.findAllByRole("menuitem");
};

it("puts the commands in the header and keeps project deletion off the page", async () => {
  renderAt("/actions/7");

  expect(
    await screen.findByRole("heading", { level: 1, name: "Call your rep" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /View action page/ }).getAttribute("href"),
  ).toMatch(/\/actions\/7$/);
  expect(await screen.findByText(/step 2 of 3/)).toBeTruthy();
  const items = await openMenu();
  expect(items.map((item) => item.textContent)).toEqual([
    "Duplicate action",
    "Export JSON",
    "Archive action",
  ]);
  expect(screen.queryByText(/delete project/i)).toBeNull();
});

it("marks the current tab and links to the others", async () => {
  renderAt("/actions/7?tab=communications");

  const tabs = within(
    await screen.findByRole("navigation", { name: "Action" }),
  );
  expect(
    tabs
      .getByRole("link", { name: "Communications" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(tabs.getByRole("link", { name: "Content" }).getAttribute("href")).toBe(
    "/actions/7?tab=content",
  );
  expect(screen.getByRole("heading", { name: "Updates" })).toBeTruthy();
});

it("nests the events and updates headings under their sections", async () => {
  renderAt("/actions/7?tab=communications");

  const subheadings = (name: string) =>
    within(screen.getByRole("region", { name }))
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
  await screen.findByRole("region", { name: "Events" });
  expect(subheadings("Events")).toEqual(["Add new event", "All events"]);
  expect(subheadings("Updates")).toEqual(["Existing updates"]);
});

it.each([
  ["details", "?tab=content"],
  ["form", "?tab=content&view=task-form"],
  ["updates", "?tab=communications"],
  ["cohort-decisions", "?tab=responses&view=cohort-decisions"],
])("moves the old %s tab to its new place", async (old, search) => {
  const router = renderAt(`/actions/7?tab=${old}`);

  await waitFor(() => expect(router.state.location.search).toBe(search));
});

it("sends the old project action page to the workspace, #release to Overview", async () => {
  const router = renderAt("/projects/3/action/7#release");

  await waitFor(() =>
    expect(router.state.location).toMatchObject({
      pathname: "/actions/7",
      search: "?tab=overview",
      hash: "#release",
    }),
  );
  expect(await screen.findByRole("heading", { name: "Release" })).toBeTruthy();
});

it("disables Duplicate with the reason while content edits are unsaved", async () => {
  renderAt("/actions/7?tab=content");

  const name = await screen.findByLabelText(/^Name/);
  act(() => {
    fireEvent.change(name, { target: { name: "name", value: "Renamed" } });
  });
  const duplicate = (await openMenu())[0];

  expect(duplicate.getAttribute("aria-disabled")).toBe("true");
  expect(duplicate.textContent).toContain(
    "Save your changes on Content to duplicate this action.",
  );
});

const editThenOpenOverview = async (actionId: number) => {
  renderAt(`/actions/${actionId}?tab=content`);
  const name = await screen.findByLabelText(/^Name/);
  act(() => {
    fireEvent.change(name, { target: { name: "name", value: "Renamed" } });
  });
  fireEvent.click(screen.getByRole("link", { name: "Overview" }));
};

it("says on Overview why a scheduled release is locked by unsaved edits", async () => {
  await editThenOpenOverview(17);

  expect(
    await screen.findByText("Save your changes on Content first"),
  ).toBeTruthy();
});

it("says nothing of unsaved edits on Overview when they lock no control there", async () => {
  await editThenOpenOverview(12);

  await screen.findByRole("heading", { name: "Timeline" });
  expect(screen.queryByText("Save your changes on Content first")).toBeNull();
});

it("shows a failed load as a failure, not an empty action", async () => {
  renderAt("/actions/8");

  expect(
    (await screen.findByText("Failed to load action")).getAttribute("role"),
  ).toBe("alert");
  expect(screen.queryByRole("navigation", { name: "Action" })).toBeNull();
});

it("opens a new action as a bare editor", async () => {
  renderAt("/actions/new");

  expect(
    await screen.findByRole("heading", { level: 1, name: "New action" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Create action" })).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "Action" })).toBeNull();
});

it("keeps a tab's sub-view in the URL", async () => {
  renderAt("/actions/7?tab=responses&view=cohort-decisions");

  const views = within(
    await screen.findByRole("navigation", { name: "Responses views" }),
  );
  expect(
    views
      .getByRole("link", { name: "Cohort decisions" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    views.getByRole("link", { name: "Responses" }).getAttribute("href"),
  ).toBe("/actions/7?tab=responses&view=responses");
});

it.each([
  ["hides", "a draft project action", 7, false],
  ["hides", "a project action in staff testing", 11, false],
  ["shows", "a scheduled project action", 12, true],
  ["shows", "a live project action", 13, true],
  ["shows", "an action outside a project", 14, true],
])(
  "%s the editor's Staff preview checkbox for %s",
  async (_, __, id, shown) => {
    renderAt(`/actions/${id}?tab=content`);

    await screen.findByLabelText(/^Name/);
    expect(
      screen.queryByRole("switch", { name: /^Staff preview/ }) !== null,
    ).toBe(shown);
  },
);

it.each([
  ["a project action", 7, true],
  ["an action outside a project", 14, false],
])(
  "gates Start staff testing on readiness only for %s",
  async (_, id, gated) => {
    renderAt(`/actions/${id}?tab=overview`);

    const start = await screen.findByRole("button", {
      name: "Start staff testing",
    });
    expect(start.hasAttribute("disabled")).toBe(gated);
    expect(screen.queryByText(/Needed before staff testing/) !== null).toBe(
      gated,
    );
  },
);

it("names an office-only action's status beside its phase", async () => {
  renderAt("/actions/18");

  const status = await screen.findByText("Office action");
  expect(status.parentElement?.textContent).toContain("Draft");
});

it("offers Stop staff testing on a closed project action still in staff preview", async () => {
  renderAt("/actions/15?tab=overview");

  const stop = await screen.findByRole("button", {
    name: "Stop staff testing",
  });
  expect(stop.hasAttribute("disabled")).toBe(false);
});

it("offers no staff testing or release controls on a closed action without a suite that launched", async () => {
  renderAt("/actions/16?tab=overview");

  await screen.findByText("Completion rate");
  expect(screen.queryByRole("button", { name: /staff testing/ })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Release" })).toBeNull();
});

it("scrolls to the section a link's hash names once the action loads", async () => {
  const scrolled: string[] = [];
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };
  try {
    renderAt("/actions/7?tab=overview#release");
    await waitFor(() => expect(scrolled).toEqual(["release"]));
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});

it("keeps a link's section in view when it opens another tab", async () => {
  const scrolled: string[] = [];
  const focused: { name: string; preventScroll?: boolean }[] = [];
  const { scrollIntoView } = Element.prototype;
  const { focus } = HTMLElement.prototype;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };
  HTMLElement.prototype.focus = function (this: HTMLElement, options) {
    focused.push({
      name: this.textContent ?? "",
      preventScroll: options?.preventScroll,
    });
  };
  try {
    renderAt("/actions/7?tab=overview");
    const needed = await screen.findByText(/Needed before staff testing/);
    const link = within(needed).getAllByRole("link")[0];
    const section = new URL(link.getAttribute("href") ?? "", "http://x").hash;
    fireEvent.click(link);

    await waitFor(() => expect(scrolled).toEqual([section.slice(1)]));
    expect(focused).toEqual([{ name: "Content", preventScroll: true }]);
  } finally {
    Element.prototype.scrollIntoView = scrollIntoView;
    HTMLElement.prototype.focus = focus;
  }
});

it("ignores a malformed hash rather than failing the page", async () => {
  renderAt("/actions/7?tab=overview#%E0%A4%A");
  expect(
    await screen.findByRole("heading", { level: 1, name: "Call your rep" }),
  ).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(
    screen.getByRole("heading", { level: 1, name: "Call your rep" }),
  ).toBeTruthy();
});
