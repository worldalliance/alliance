import type { MemberListDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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

const renderPage = () =>
  render(
    <MemoryRouter>
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
  ).toBe(`/member-lists/${id}`);
});

test("says when there are no lists yet", async () => {
  stored = [];
  renderPage();
  expect(
    await screen.findByText(
      "No lists yet. Create one to pick members by hand for a formula.",
    ),
  ).toBeTruthy();
});

test("says when the lists couldn't load", async () => {
  stored = null;
  renderPage();
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn't load lists.",
  );
});
