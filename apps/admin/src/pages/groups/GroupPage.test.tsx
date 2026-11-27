import { onlineManager } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { api, renderPage, serveGroupPageApi } from "./groupPageTesting";

serveGroupPageApi();

it("shows the group with that id", async () => {
  renderPage();

  expect(await screen.findByRole("heading", { name: "North" })).toBeTruthy();
});

it("says when no group has that id", async () => {
  renderPage({ id: "9" });

  expect(await screen.findByText("Group not found")).toBeTruthy();
});

it("says when the id is not a number", async () => {
  renderPage({ id: "abc" });

  expect(await screen.findByText("Group not found")).toBeTruthy();
});

it("says the id is not a number without waiting for the groups", async () => {
  onlineManager.setOnline(false);
  renderPage({ id: "abc" });

  expect(await screen.findByText("Group not found")).toBeTruthy();
});

it("says why loading the group was refused", async () => {
  api.listStatus = 403;
  renderPage();

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("keeps loading while offline rather than saying the group is missing", async () => {
  onlineManager.setOnline(false);
  renderPage();

  expect(await screen.findByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("waits for the refetch when the cached list predates the group", async () => {
  renderPage({ cached: [] });

  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(
    await screen.findByRole("heading", { level: 1, name: "North" }),
  ).toBeTruthy();
});

it("keeps loading offline when the cached list predates the group", async () => {
  onlineManager.setOnline(false);
  renderPage({ cached: [] });

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("says why the refetch failed when the cached list predates the group", async () => {
  api.listStatus = 403;
  renderPage({ cached: [] });

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("says a failed load once when the cached list predates the group", async () => {
  api.listStatus = 403;
  renderPage({ cached: [] });

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText(/Couldn't refresh/)).toBeNull();
});
