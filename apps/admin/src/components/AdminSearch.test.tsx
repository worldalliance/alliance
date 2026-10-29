import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemoryRouter, Route, Routes } from "react-router";
import AdminSearch from "./AdminSearch";

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

const renderSearch = () =>
  render(
    <MemoryRouter>
      <AdminSearch />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/member/:userId" element={<p>Member page</p>} />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

it("opens on ⌘K and goes to the highlighted result on Enter", async () => {
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  const input = await screen.findByRole("textbox", { name: "Search" });
  fireEvent.change(input, { target: { value: "ana" } });
  await screen.findByText("ana@example.org");
  fireEvent.keyDown(input, { key: "Enter" });

  expect(await screen.findByText("Member page")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Search" })).toBeNull();
});

it("says which lists failed to load, since they aren't searched", async () => {
  failForms = true;
  renderSearch();

  fireEvent.click(screen.getByRole("button", { name: /Search/ }));

  expect(
    await screen.findByText("Couldn't load forms, so they aren't searched."),
  ).toBeTruthy();
});

it("still opens a result that arrives after arrowing through none", async () => {
  let release = () => {};
  usersArrive = new Promise((resolve) => (release = resolve));
  renderSearch();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  const input = await screen.findByRole("textbox", { name: "Search" });
  fireEvent.change(input, { target: { value: "ana@" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  release();
  await screen.findByText("ana@example.org");
  fireEvent.keyDown(input, { key: "Enter" });

  expect(await screen.findByText("Member page")).toBeTruthy();
});
