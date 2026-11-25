import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useInvalidateActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import { ToastProvider } from "../ui/ToastProvider";
import ActionsList from "./Actions";

const loaded = [
  adminActionListItem(1, "Call your rep"),
  adminActionListItem(2, "Old petition", { archived: true }),
];

let loadStatus = 200;
let served = loaded;

serveApi(
  routes({
    "GET /actions/all": () =>
      loadStatus === 200
        ? Response.json(served)
        : Response.json({}, { status: loadStatus }),
    "GET /user/tags": () => Response.json([]),
    "GET /tasks/listForms": () => Response.json([]),
  }),
);

beforeEach(() => {
  loadStatus = 200;
  served = loaded;
});

const renderPage = (query = queryWrapper(), url = "/") => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <ToastProvider>
            <ActionsList />
          </ToastProvider>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  render(<RouterProvider router={router} />, query);
  return router;
};

const archivedToggle = () =>
  screen.getByRole<HTMLInputElement>("checkbox", { name: "Show archived" });

it("lists the loaded actions that are not archived", async () => {
  renderPage();
  expect((await screen.findAllByText("Call your rep")).length).toBeGreaterThan(
    0,
  );
  expect(screen.queryByText("Old petition")).toBeNull();
});

it("says the actions failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Failed to load actions")).toBeTruthy();
  expect(
    screen.queryByText("No actions yet. Create one to get started."),
  ).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded actions beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findAllByText("Call your rep");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText("Failed to load actions")).toBeTruthy();
  expect(screen.getAllByText("Call your rep").length).toBeGreaterThan(0);
});

it("shows a write once the list is invalidated", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findAllByText("Call your rep");

  served = [adminActionListItem(1, "Call your senator")];
  const invalidate = renderHook(() => useInvalidateActionsAdmin(), query);
  await act(() => invalidate.result.current());

  expect(
    (await screen.findAllByText("Call your senator")).length,
  ).toBeGreaterThan(0);
});

it("shows a refetch error above an empty list", async () => {
  served = [];
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("No actions yet. Create one to get started.");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText("Failed to load actions")).toBeTruthy();
  expect(
    screen.getByText("No actions yet. Create one to get started."),
  ).toBeTruthy();
});

it("offers the create menu when there are no actions", async () => {
  served = [];
  renderPage();
  await screen.findByText("No actions yet. Create one to get started.");
  expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
});

it("lists an archived action, marked in the timeline, once archived ones are shown", async () => {
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  renderPage();
  expect(
    await screen.findByText(/^Every action is archived\./, { selector: "div" }),
  ).toBeTruthy();
  expect(
    screen.queryByText("No actions with timeline events found."),
  ).toBeNull();
  expect(screen.queryByText("Old petition")).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "Show archived actions" }),
  );

  expect((await screen.findAllByText("Old petition")).length).toBeGreaterThan(
    0,
  );
  expect(archivedToggle().checked).toBe(true);
  expect(document.activeElement).toBe(archivedToggle());
  expect(screen.getByText("archived")).toBeTruthy();
});

it("keeps archived actions shown when the page opens from a link that shows them", async () => {
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  renderPage(queryWrapper(), "/tasks?view=list&archived=1");

  expect((await screen.findAllByText("Old petition")).length).toBeGreaterThan(
    0,
  );
  expect(archivedToggle().checked).toBe(true);

  const toggle = archivedToggle();
  act(() => toggle.focus());
  fireEvent.click(toggle);

  expect(
    await screen.findByText("Every action is archived.", {
      selector: "[role=status]",
    }),
  ).toBeTruthy();
  expect(screen.queryByText("Old petition")).toBeNull();
  expect(document.activeElement).toBe(toggle);
});

it("steps back through archived toggles with Back", async () => {
  const router = renderPage(queryWrapper(), "/tasks?view=list");
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Show archived" }),
  );
  expect((await screen.findAllByText("Old petition")).length).toBeGreaterThan(
    0,
  );

  await act(() => router.navigate(-1));

  expect(archivedToggle().checked).toBe(false);
  expect(screen.queryByText("Old petition")).toBeNull();
});

it("keeps the status menu open, and focus on its item, as its last match is filtered out and back in", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: /^Actions/ }));
  const draft = () => screen.getByRole("menuitemcheckbox", { name: "Draft" });
  await screen.findByRole("menuitemcheckbox", { name: "Draft" });

  act(() => draft().focus());
  fireEvent.click(draft());
  expect(
    await screen.findByText("No actions match the selected statuses.", {
      selector: "[role=status]",
    }),
  ).toBeTruthy();
  expect(
    screen.getByText("No actions match the selected statuses.", {
      selector: "div",
    }),
  ).toBeTruthy();
  expect(document.activeElement).toBe(draft());
  expect(screen.getByRole("menuitemcheckbox", { name: "Active" })).toBeTruthy();

  fireEvent.click(draft());
  await waitFor(() =>
    expect(
      screen.queryAllByText("No actions match the selected statuses."),
    ).toHaveLength(0),
  );
  expect(document.activeElement).toBe(draft());
});

it("says the status filter hides every action, rather than that none has events, in a status region mounted before the list loads", async () => {
  served = [adminActionListItem(4, "Rally", { status: "completed" })];
  renderPage();
  const region = screen.getByText("", { selector: "p[role=status]" });
  expect(region.textContent).toBe("");

  await waitFor(() =>
    expect(region.textContent).toBe("No actions match the selected statuses."),
  );
  expect(
    screen.getByText("No actions match the selected statuses.", {
      selector: "div",
    }),
  ).toBeTruthy();
  expect(
    screen.queryByText("No actions with timeline events found."),
  ).toBeNull();
});

it("lists a suite with only archived actions after the others", async () => {
  const suiteFields = {
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    events: [],
  };
  served = [
    adminActionListItem(2, "Old petition", {
      archived: true,
      suite: { ...suiteFields, id: 8, name: "Retired suite" },
    }),
    adminActionListItem(3, "Call your rep", {
      suite: { ...suiteFields, id: 9, name: "Live suite" },
    }),
  ];
  renderPage();

  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Show archived" }),
  );

  const retired = await screen.findByRole("link", { name: "Retired suite" });
  const live = screen.getAllByRole("link", { name: "Live suite" }).at(-1)!;
  expect(
    live.compareDocumentPosition(retired) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("links an in-progress suite card to its suite and each action to itself, nesting no link", async () => {
  const suite = {
    id: 5,
    name: "Fall push",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    events: [],
  };
  served = [
    adminActionListItem(1, "Call your rep", { suite }),
    adminActionListItem(3, "Write a letter", { suite }),
    adminActionListItem(4, "Rally", { suite, status: "member_action" }),
  ];
  renderPage();
  const section = (
    await screen.findByText("Suites with draft or active actions")
  ).closest("section");
  if (!section) throw new Error("no in-progress suites section");
  const hrefs = [...section.querySelectorAll("a")].map((link) =>
    link.getAttribute("href"),
  );
  expect(hrefs).toEqual([
    "/tasks/suites/5",
    "/tasks/1",
    "/tasks/3",
    "/tasks/4",
  ]);
  expect(section.querySelector("a a")).toBeNull();
  expect(section.textContent).toContain("1 active · 2 draft");
});

it("keeps the selected statuses when the page opens from a link", async () => {
  served = [adminActionListItem(4, "Rally", { status: "completed" })];
  renderPage(queryWrapper(), "/tasks?view=list&status=completed");

  expect(await screen.findAllByText("Rally")).toHaveLength(2);
  expect(
    screen.queryByText("No actions match the selected statuses."),
  ).toBeNull();
});

it("writes the status filter to the URL, leaving it out at the defaults and keeping other params", async () => {
  served = [
    adminActionListItem(1, "Call your rep"),
    adminActionListItem(4, "Rally", { status: "completed" }),
  ];
  const router = renderPage(queryWrapper(), "/tasks?view=list&other=1");
  // The list below the timeline always names Rally; the timeline only when shown.
  const rallyShownInTimeline = () => screen.getAllByText("Rally").length === 2;
  const toggleCompleted = async () => {
    const trigger = await screen.findByRole("button", { name: /^Actions/ });
    if (trigger.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(trigger);
    }
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Completed" }),
    );
  };

  await toggleCompleted();
  expect(router.state.location.search).toBe(
    "?view=list&other=1&status=active%2Cpending%2Cdraft%2Ccompleted",
  );
  expect(rallyShownInTimeline()).toBe(true);

  await toggleCompleted();
  expect(router.state.location.search).toBe("?view=list&other=1");
  expect(rallyShownInTimeline()).toBe(false);

  await act(() => router.navigate(-1));
  expect(router.state.location.search).toBe(
    "?view=list&other=1&status=active%2Cpending%2Cdraft%2Ccompleted",
  );
  expect(rallyShownInTimeline()).toBe(true);
});
