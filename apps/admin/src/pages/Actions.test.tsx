import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useInvalidateActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
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

const Search = () => (
  <output data-testid="search">{useLocation().search}</output>
);

const renderPage = (query = queryWrapper(), url = "/") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <ActionsList />
        <Search />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

const archivedCheckbox = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.findByRole<HTMLInputElement>("checkbox", {
    name: "Include archived",
  });
};

const VISIBLE = { selector: ":not([role=status])" };
const announced = () =>
  document.querySelector("p.sr-only[role=status]")?.textContent;

const suiteFields = {
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  events: [],
};

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
  expect(screen.queryByRole("searchbox")).toBeNull();
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

it("lists an archived action, marked archived, once archived ones are shown", async () => {
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  renderPage();
  expect(
    await screen.findByText(/^Every action is archived\./, VISIBLE),
  ).toBeTruthy();
  expect(announced()).toBe("Every action is archived.");
  expect(screen.queryByText("Old petition")).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "Show archived actions" }),
  );

  expect(await screen.findByText("Old petition")).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Remove filter: Include archived" }),
  );
  expect(screen.getByText("Archived")).toBeTruthy();
  expect((await archivedCheckbox()).checked).toBe(true);
  expect(screen.getByTestId("search").textContent).toBe("?archived=1");
});

it("keeps archived actions shown when the page opens from a link that shows them", async () => {
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  renderPage(queryWrapper(), "/actions?archived=1");

  expect(await screen.findByText("Old petition")).toBeTruthy();
  const checkbox = await archivedCheckbox();
  expect(checkbox.checked).toBe(true);

  fireEvent.click(checkbox);

  expect(
    await screen.findByText(/^Every action is archived\./, VISIBLE),
  ).toBeTruthy();
  expect(announced()).toBe("Every action is archived.");
  expect(screen.queryByText("Old petition")).toBeNull();
});

it("says the filters hide every action, rather than that there are none, in a status region mounted before the list loads", async () => {
  served = [adminActionListItem(4, "Rally", { status: "completed" })];
  renderPage();
  const region = document.querySelector("p.sr-only[role=status]");
  expect(region?.textContent).toBe("");

  expect(
    await screen.findByText("No actions match these filters.", VISIBLE),
  ).toBeTruthy();
  expect(region?.textContent).toBe("No actions match these filters.");
  expect(
    screen.queryByText("No actions yet. Create one to get started."),
  ).toBeNull();
});

it("shows the default status filter as a chip that removes it", async () => {
  served = [adminActionListItem(4, "Rally", { status: "completed" })];
  renderPage();
  const chips = await screen.findByRole("list", { name: "Active filters" });
  expect(chips.textContent).toBe("Status: Active, Pending, Draft");

  fireEvent.click(
    within(chips).getByRole("button", { name: /^Remove filter: Status/ }),
  );

  expect(await screen.findByText("Rally")).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  expect(decodeURIComponent(screen.getByTestId("search").textContent!)).toBe(
    "?status=active,pending,draft,onboarding,completed",
  );
});

it("clears the search and returns the filters to their defaults, keeping the layout", async () => {
  served = [
    adminActionListItem(1, "Call your rep"),
    adminActionListItem(4, "Rally", { status: "completed" }),
  ];
  renderPage(
    queryWrapper(),
    "/actions?q=Rally&status=completed&archived=1&group=suite",
  );
  expect(await screen.findByText("Rally")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

  expect(await screen.findByText("Call your rep")).toBeTruthy();
  expect(screen.queryByText("Rally")).toBeNull();
  expect(screen.getByTestId("search").textContent).toBe("?group=suite");
  expect(screen.getByRole("list", { name: "Active filters" }).textContent).toBe(
    "Status: Active, Pending, Draft",
  );
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
});

it("offers no Clear all when the default filters alone hide every action", async () => {
  served = [adminActionListItem(4, "Rally", { status: "completed" })];
  renderPage(queryWrapper(), "/actions");

  expect(
    await screen.findByText("No actions match these filters.", VISIBLE),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
});

it("searches action names and keeps the search in the URL", async () => {
  served = [
    adminActionListItem(1, "Call your rep"),
    adminActionListItem(3, "Write a letter"),
  ];
  renderPage(queryWrapper(), "/actions?q=LETTER");

  expect(await screen.findByText("Write a letter")).toBeTruthy();
  expect(screen.queryByText("Call your rep")).toBeNull();
  expect(
    screen.getByRole<HTMLInputElement>("searchbox", { name: "Search actions" })
      .value,
  ).toBe("LETTER");
});

it("groups by suite on request, with suites holding only archived actions last", async () => {
  served = [
    adminActionListItem(2, "Old petition", {
      archived: true,
      suite: { ...suiteFields, id: 8, name: "Retired suite" },
    }),
    adminActionListItem(3, "Call your rep", {
      status: "office_action",
      suite: { ...suiteFields, id: 9, name: "Live suite" },
    }),
  ];
  renderPage(queryWrapper(), "/actions?archived=1");
  await screen.findByText("Call your rep");
  expect(screen.queryByRole("heading", { name: /Live suite/ })).toBeNull();

  fireEvent.click(screen.getByRole("checkbox", { name: "Group by suite" }));

  const headings = (await screen.findAllByRole("heading", { level: 2 })).map(
    (heading) => heading.textContent,
  );
  expect(headings).toEqual(["Live suite 1", "Retired suite 1"]);
  expect(
    screen
      .getByRole("link", { name: "Open suite Retired suite" })
      .getAttribute("href"),
  ).toBe("/suites/8");
  expect(screen.getByTestId("search").textContent).toBe(
    "?archived=1&group=suite",
  );
});

it("lists in-progress suites above the filters, whatever the filters hide", async () => {
  const suite = { id: 5, name: "Fall push", ...suiteFields };
  served = [
    adminActionListItem(1, "Call your rep", { suite }),
    adminActionListItem(3, "Write a letter", { suite }),
    adminActionListItem(4, "Rally", { suite, status: "member_action" }),
  ];
  renderPage(queryWrapper(), "/actions?q=nothing");
  const section = await screen.findByRole("region", {
    name: /^In-progress suites/,
  });
  expect(
    [...section.querySelectorAll("a")].map((link) => link.getAttribute("href")),
  ).toEqual(["/suites/5", "/actions/1", "/actions/3", "/actions/4"]);
  expect(section.textContent).toContain("1 active · 2 draft");
  expect(
    section.compareDocumentPosition(screen.getByRole("searchbox")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("shows the timeline instead of the list when the URL asks for it", async () => {
  renderPage(queryWrapper(), "/actions?view=timeline");

  expect(await screen.findByText("Call your rep")).toBeTruthy();
  expect(
    screen.getByRole<HTMLInputElement>("radio", { name: "Timeline" }).checked,
  ).toBe(true);
  expect(screen.queryByRole("checkbox", { name: "Group by suite" })).toBeNull();
  expect(screen.queryByRole("region", { name: /^Actions/ })).toBeNull();

  fireEvent.click(screen.getByRole("radio", { name: "List" }));

  expect(screen.getByTestId("search").textContent).toBe("");
  expect(screen.getByRole("checkbox", { name: "Group by suite" })).toBeTruthy();
  expect(screen.getByRole("region", { name: /^Actions/ })).toBeTruthy();
});

it("keeps the selected statuses when the page opens from a link", async () => {
  served = [adminActionListItem(4, "Rally", { status: "completed" })];
  renderPage(queryWrapper(), "/actions?status=completed");

  expect(await screen.findByText("Rally")).toBeTruthy();
  expect(screen.queryByText("No actions match these filters.")).toBeNull();
});
