import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useInvalidateActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { act, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  }),
);

beforeEach(() => {
  loadStatus = 200;
  served = loaded;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ActionsList />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

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
  expect(screen.queryByText("No actions found.")).toBeNull();
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
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("No actions found.");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText("Failed to load actions")).toBeTruthy();
  expect(screen.getByText("No actions found.")).toBeTruthy();
});

it("offers the create menu when no actions are unarchived", async () => {
  served = [adminActionListItem(2, "Old petition", { archived: true })];
  renderPage();
  await screen.findByText("No actions found.");
  expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
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
    "/suites/5",
    "/actions/1",
    "/actions/3",
    "/actions/4",
  ]);
  expect(section.querySelector("a a")).toBeNull();
  expect(section.textContent).toContain("1 active · 2 draft");
});
