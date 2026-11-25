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
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { adminActionListItem } from "../../lib/testing/adminActionListItem";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import TasksPage from "./TasksPage";

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

const LIST = "/tasks?view=list";
/** The filter bar's count, not a timeline group's. */
const COUNT = "[aria-live=polite]";

const renderPage = (query = queryWrapper(), url = LIST) => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <ToastProvider>
            <TasksPage />
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

const taskLink = (name: string) => screen.queryByRole("link", { name });

it("lists the loaded tasks that are not archived", async () => {
  renderPage();
  expect(
    await screen.findByRole("link", { name: "Call your rep" }),
  ).toBeTruthy();
  expect(screen.queryByText("Old petition")).toBeNull();
});

it("says the tasks failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Couldn't load tasks")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No tasks yet")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded tasks beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByRole("link", { name: "Call your rep" });

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText(/^Couldn't refresh tasks\./)).toBeTruthy();
  expect(taskLink("Call your rep")).toBeTruthy();
});

it("shows a write once the list is invalidated", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByRole("link", { name: "Call your rep" });

  served = [adminActionListItem(1, "Call your senator")];
  const invalidate = renderHook(() => useInvalidateActionsAdmin(), query);
  await act(() => invalidate.result.current());

  expect(
    await screen.findByRole("link", { name: "Call your senator" }),
  ).toBeTruthy();
});

it("shows a refetch error above an empty list", async () => {
  served = [];
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("No tasks yet");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText(/^Couldn't refresh tasks\./)).toBeTruthy();
  expect(screen.getByText("No tasks yet")).toBeTruthy();
});

it("offers the create menu when there are no tasks", async () => {
  served = [];
  renderPage();
  await screen.findByText("No tasks yet");
  expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
});

it("lists an archived task, marked in the list, once archived ones are shown", async () => {
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  renderPage();
  expect(await screen.findByText("Every task is archived")).toBeTruthy();
  expect(screen.queryByText("No tasks yet")).toBeNull();
  expect(screen.queryByText("Old petition")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Show archived tasks" }));

  expect(
    await screen.findByRole("link", { name: "Old petition" }),
  ).toBeTruthy();
  expect(archivedToggle().checked).toBe(true);
  expect(document.activeElement).toBe(archivedToggle());
  expect(screen.getByText("Archived")).toBeTruthy();
});

it("keeps archived tasks shown when the page opens from a link that shows them", async () => {
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  renderPage(queryWrapper(), "/tasks?view=list&archived=1");

  expect(
    await screen.findByRole("link", { name: "Old petition" }),
  ).toBeTruthy();
  expect(archivedToggle().checked).toBe(true);

  const toggle = archivedToggle();
  act(() => toggle.focus());
  fireEvent.click(toggle);

  expect(
    await screen.findByText("Every task is archived.", {
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
  expect(
    await screen.findByRole("link", { name: "Old petition" }),
  ).toBeTruthy();

  await act(() => router.navigate(-1));

  expect(archivedToggle().checked).toBe(false);
  expect(screen.queryByText("Old petition")).toBeNull();
});

it("keeps the status menu open, and focus on its item, as its last match is filtered out and back in", async () => {
  renderPage(queryWrapper(), "/tasks");
  await screen.findByText("1 of 2 tasks");
  fireEvent.click(screen.getByRole("button", { name: /^Status/ }));
  const draft = () => screen.getByRole("menuitemcheckbox", { name: "Draft" });
  await screen.findByRole("menuitemcheckbox", { name: "Draft" });

  act(() => draft().focus());
  fireEvent.click(draft());
  expect(
    await screen.findByText("No tasks match the selected statuses.", {
      selector: "[role=status]",
    }),
  ).toBeTruthy();
  expect(document.activeElement).toBe(draft());
  expect(screen.getByRole("menuitemcheckbox", { name: "Active" })).toBeTruthy();

  fireEvent.click(draft());
  await waitFor(() =>
    expect(
      screen.queryAllByText("No tasks match the selected statuses."),
    ).toHaveLength(0),
  );
  expect(document.activeElement).toBe(draft());
});

it("says the status filter hides every task, rather than that there are none, in a status region mounted before the list loads", async () => {
  served = [adminActionListItem(4, "Rally", { status: "completed" })];
  renderPage(queryWrapper(), "/tasks");
  const region = screen.getByText("", { selector: "p[role=status]" });
  expect(region.textContent).toBe("");

  await waitFor(() =>
    expect(region.textContent).toBe("No tasks match the selected statuses."),
  );
  expect(screen.queryByText("No tasks yet")).toBeNull();
});

it("lists a suite with only archived tasks after the others", async () => {
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
  const live = screen.getByRole("link", { name: "Live suite" });
  expect(
    live.compareDocumentPosition(retired) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("links a suite's group to its suite, counting its tasks in progress, and each task to itself, nesting no link", async () => {
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
  await screen.findByRole("link", { name: "Fall push" });
  const section = screen.getByRole("table");
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
  renderPage(queryWrapper(), "/tasks?status=completed");

  expect(
    await screen.findByRole("button", { name: /^Status · Completed/ }),
  ).toBeTruthy();
  expect(await screen.findByText("1 task", { selector: COUNT })).toBeTruthy();
  expect(
    screen.queryByText("No tasks match the selected statuses."),
  ).toBeNull();
});

it("lists every unarchived task whatever its status, with no status filter", async () => {
  served = [
    adminActionListItem(1, "Call your rep"),
    adminActionListItem(4, "Rally", { status: "completed" }),
    adminActionListItem(5, "Welcome", { onboarding: true }),
  ];
  renderPage(queryWrapper(), "/tasks?view=list&status=draft");

  expect(await screen.findByRole("link", { name: "Rally" })).toBeTruthy();
  expect(taskLink("Welcome")).toBeTruthy();
  expect(taskLink("Call your rep")).toBeTruthy();
  expect(screen.getByText("3 tasks")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Status/ })).toBeNull();
});

it("writes the status filter to the URL, leaving it out at the defaults and keeping other params", async () => {
  served = [
    adminActionListItem(1, "Call your rep"),
    adminActionListItem(4, "Rally", { status: "completed" }),
  ];
  const router = renderPage(queryWrapper(), "/tasks?other=1");
  await screen.findByText("1 of 2 tasks");
  const rallyShown = () =>
    screen.queryByText("2 tasks", { selector: COUNT }) !== null;
  const toggleCompleted = async () => {
    const trigger = await screen.findByRole("button", { name: /^Status/ });
    if (trigger.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(trigger);
    }
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Completed" }),
    );
  };

  await toggleCompleted();
  expect(router.state.location.search).toBe(
    "?other=1&status=active%2Cpending%2Cdraft%2Ccompleted",
  );
  expect(rallyShown()).toBe(true);

  await toggleCompleted();
  expect(router.state.location.search).toBe("?other=1");
  expect(rallyShown()).toBe(false);

  await act(() => router.navigate(-1));
  expect(router.state.location.search).toBe(
    "?other=1&status=active%2Cpending%2Cdraft%2Ccompleted",
  );
  expect(rallyShown()).toBe(true);
});

it("opens on the timeline with the status filter, hides it on the list, and keeps it in the URL across views", async () => {
  const router = renderPage(queryWrapper(), "/tasks?status=draft");
  expect(
    await screen.findByRole("button", { name: /^Status · Draft/ }),
  ).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: "List" }));

  expect(await screen.findByRole("table")).toBeTruthy();
  expect(router.state.location.search).toBe("?status=draft&view=list");
  expect(screen.queryByRole("button", { name: /^Status/ })).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
  expect(
    await screen.findByRole("button", { name: /^Status · Draft/ }),
  ).toBeTruthy();
});
