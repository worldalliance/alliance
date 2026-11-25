import type { MemberListDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import MemberListsPage from "./MemberListsPage";

let stored: MemberListDto[] | null;

serveApi(
  routes({
    "GET /member-lists": () =>
      stored === null
        ? Response.json({ message: "Unavailable" }, { status: 503 })
        : Response.json(stored),
  }),
);

const renderPage = (url = "/members/lists") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MemberListsPage />
    </MemoryRouter>,
    queryWrapper(),
  );

test("lists each list with its member count, linking to it", async () => {
  const id = "00000000-0000-4000-8000-0000000000a1";
  stored = [{ id, name: "Volunteers", versionId: 1, userIds: [7, 12] }];
  renderPage();
  const row = (await screen.findByRole("link", { name: "Volunteers" })).closest(
    "tr",
  );
  expect(row).not.toBeNull();
  if (row === null) return;
  expect(within(row).getByText("2")).toBeTruthy();
  expect(
    within(row).getByRole("link", { name: "Volunteers" }).getAttribute("href"),
  ).toBe(`/members/lists/${id}`);
});

test("says when there are no lists yet", async () => {
  stored = [];
  renderPage();
  expect(await screen.findByText("No lists yet")).toBeTruthy();
  expect(
    screen.getByText("Create one to pick members by hand for a formula."),
  ).toBeTruthy();
});

test("says when the lists couldn't load", async () => {
  stored = null;
  renderPage();
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Couldn't load member lists")).toBeTruthy();
  expect(within(alert).getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
});

test("filters lists by name from ?q=, with a way out of no results", async () => {
  stored = [
    {
      id: "00000000-0000-4000-8000-0000000000a1",
      name: "Volunteers",
      versionId: 1,
      userIds: [],
    },
    {
      id: "00000000-0000-4000-8000-0000000000a2",
      name: "Donors",
      versionId: 1,
      userIds: [],
    },
  ];
  renderPage("/members/lists?q=vol");
  expect(await screen.findByRole("link", { name: "Volunteers" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Donors" })).toBeNull();

  fireEvent.change(screen.getByRole("searchbox", { name: "Filter lists" }), {
    target: { value: "nobody" },
  });
  expect(await screen.findByText("No results")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(await screen.findByRole("link", { name: "Donors" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Volunteers" })).toBeTruthy();
});
