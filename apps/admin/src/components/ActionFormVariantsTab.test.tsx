import type { ActionFormVariantDto } from "@alliance/shared/client";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, spyOn } from "bun:test";
import { MemoryRouter } from "react-router";
import ActionFormVariantsTab from "./ActionFormVariantsTab";

const variant: ActionFormVariantDto = {
  id: 1,
  actionId: 2,
  formId: 11,
  name: "Variant A",
  splitValue: 0.3,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

let loadStatus = 200;
let writeStatus = 200;
let created: string[] = [];

serveApi(
  routes({
    "GET /actions/:id/form-variants": () =>
      loadStatus === 200
        ? Response.json({ variants: [variant], stats: [] })
        : Response.json({}, { status: loadStatus }),
    "POST /actions/:id/form-variants": async ({ request }) => {
      const body: { name: string } = await request.json();
      if (body.name === "Variant C") {
        return Response.json(
          { message: "Splits exceed 100%" },
          { status: 400 },
        );
      }
      created.push(body.name);
      return Response.json({ ...variant, id: 2, name: body.name });
    },
    "PATCH /actions/form-variants/:variantId": () =>
      Response.json({ message: "Variant is locked" }, { status: writeStatus }),
    "DELETE /actions/form-variants/:variantId": () =>
      Response.json({ message: "Users are assigned" }, { status: 409 }),
  }),
);

beforeEach(() => {
  loadStatus = 200;
  writeStatus = 200;
  created = [];
});

const renderTab = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <ActionFormVariantsTab action={makeAction({ id: 2, taskFormId: 9 })} />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

it("says so when the variants fail to load", async () => {
  loadStatus = 500;
  renderTab();

  expect(await screen.findByText("Failed to load variants.")).toBeTruthy();
});

it("keeps the refused draft and the ones after it staged", async () => {
  renderTab();
  const add = await screen.findByRole("button", { name: "Add variant" });
  fireEvent.click(add);
  fireEvent.click(add);

  fireEvent.click(screen.getByRole("button", { name: "Publish drafts (2)" }));

  expect(await screen.findByText("Splits exceed 100%")).toBeTruthy();
  expect(created).toEqual(["Variant B"]);
  expect(await screen.findByText("Published 1 variant")).toBeTruthy();
  expect(screen.getByDisplayValue("Variant C")).toBeTruthy();
  expect(screen.queryByDisplayValue("Variant B")).toBeNull();
});

it("keeps the staged drafts on screen when the reload after a publish fails", async () => {
  renderTab();
  const add = await screen.findByRole("button", { name: "Add variant" });
  fireEvent.click(add);
  fireEvent.click(add);
  loadStatus = 500;

  fireEvent.click(screen.getByRole("button", { name: "Publish drafts (2)" }));

  expect(await screen.findByText("Failed to load variants.")).toBeTruthy();
  expect(screen.getByDisplayValue("Variant C")).toBeTruthy();
  expect(screen.getByDisplayValue("Variant A")).toBeTruthy();
});

it("shows the server's refusal of an edit", async () => {
  writeStatus = 409;
  renderTab();
  fireEvent.change(await screen.findByDisplayValue("Variant A"), {
    target: { value: "Renamed" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Variant is locked")).toBeTruthy();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.getByDisplayValue("Renamed")).toBeTruthy();
});

it("shows the server's refusal of a delete", async () => {
  spyOn(window, "confirm").mockReturnValue(true);
  renderTab();

  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

  expect(await screen.findByText("Users are assigned")).toBeTruthy();
  expect(screen.getByDisplayValue("Variant A")).toBeTruthy();
});
