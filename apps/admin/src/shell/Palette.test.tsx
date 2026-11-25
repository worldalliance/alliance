import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { CountId, PLACES } from "../places";
import Palette from "./Palette";

let failForms = false;
let usersArrive = Promise.resolve();
afterEach(() => {
  failForms = false;
  usersArrive = Promise.resolve();
});

serveApi(
  routes({
    "GET /user/list": async () => {
      await usersArrive;
      return Response.json([
        {
          id: 10,
          name: "Ana Lee",
          email: "ana@example.org",
          phoneNumber: null,
        },
      ]);
    },
    "GET /actions/all": () =>
      Response.json([{ id: 4, name: "Call your senator", archived: false }]),
    "GET /actions/suites": () => Response.json([]),
    "GET /tasks/listForms": () =>
      failForms
        ? Response.json({ statusCode: 500 }, { status: 500 })
        : Response.json([]),
    "GET /community/list": () => Response.json([]),
  }),
);

const Search = () => {
  const [open, setOpen] = useState(false);
  return (
    <Palette
      open={open}
      onOpenChange={setOpen}
      counts={{
        [CountId.NeedsReply]: 0,
        [CountId.WelcomeQueue]: 12,
        [CountId.AwaitingGroup]: 0,
        [CountId.PartnershipResponses]: 0,
      }}
    />
  );
};

const renderSearch = () =>
  render(
    <MemoryRouter>
      <Search />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/members/:userId" element={<p>Member page</p>} />
        <Route
          path="/activity/scheduled"
          element={<p>Scheduled jobs page</p>}
        />
        <Route path="/inbox" element={<p>Inbox page</p>} />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

it("opens on ⌘K and goes to the highlighted result on Enter", async () => {
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  const input = await screen.findByRole("combobox", { name: "Search" });
  fireEvent.change(input, { target: { value: "ana" } });
  await screen.findByText("ana@example.org");
  fireEvent.keyDown(input, { key: "Enter" });

  expect(await screen.findByText("Member page")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Search" })).toBeNull();
});

it("says which lists failed to load, since they aren't searched", async () => {
  failForms = true;
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });

  expect(
    await screen.findByText("Couldn't load forms, so they aren't searched."),
  ).toBeTruthy();
});

it("still opens a result that arrives after arrowing through none", async () => {
  let release = () => {};
  usersArrive = new Promise((resolve) => (release = resolve));
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  const input = await screen.findByRole("combobox", { name: "Search" });
  fireEvent.change(input, { target: { value: "ana@" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  release();
  await screen.findByText("ana@example.org");
  fireEvent.keyDown(input, { key: "Enter" });

  expect(await screen.findByText("Member page")).toBeTruthy();
});

it("lists every place by area before anything is typed", async () => {
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  await screen.findByRole("combobox", { name: "Search" });

  const options = screen
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
  expect(options).toHaveLength(PLACES.length);
  for (const place of PLACES) {
    expect(options.some((option) => option.startsWith(place.label))).toBe(true);
  }
  expect(screen.getAllByRole("group")).toHaveLength(7);
  expect(
    screen.getByRole("option", { name: "Welcome queue (12)" }),
  ).toBeTruthy();
});

it("browses the places with the arrow keys and opens one on Enter", async () => {
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  const input = await screen.findByRole("combobox", { name: "Search" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(await screen.findByText("Inbox page")).toBeTruthy();
});

it("finds a page by the name it had before the redesign", async () => {
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  const input = await screen.findByRole("combobox", { name: "Search" });
  fireEvent.change(input, { target: { value: "scheduled plans" } });
  expect(
    (await screen.findByRole("option", { name: /Scheduled jobs/ })).textContent,
  ).toContain("Was Scheduled plans");
  fireEvent.keyDown(input, { key: "Enter" });

  expect(await screen.findByText("Scheduled jobs page")).toBeTruthy();
});

it("closes on a second ⌘K", async () => {
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  await screen.findByRole("combobox", { name: "Search" });
  fireEvent.keyDown(window, { key: "k", metaKey: true });

  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Search" })).toBeNull(),
  );
});
