import type { ActionFormVariantDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { ToastProvider } from "../../../ui/ToastProvider";
import { VariantsTab } from "./VariantsTab";

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
let errors: (string | null)[] = [];
let openedTabs: string[] = [];

serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([]),
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
  errors = [];
  openedTabs = [];
});

const renderTab = (taskFormId: number | null = 9) =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <VariantsTab
          task={makeParsedAction({ id: 2, taskFormId })}
          openTab={(tab) => openedTabs.push(tab)}
          setError={(message) => errors.push(message)}
        />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

it("says so when the variants fail to load", async () => {
  loadStatus = 500;
  renderTab();

  expect(await screen.findByText("Failed to load variants.")).toBeTruthy();
  expect(screen.getByText("Couldn't load variants")).toBeTruthy();
});

it("keeps the refused draft and the ones after it staged", async () => {
  renderTab();
  const add = await screen.findByRole("button", { name: "Add variant" });
  fireEvent.click(add);
  fireEvent.click(add);

  fireEvent.click(screen.getByRole("button", { name: "Publish drafts (2)" }));

  await waitFor(() => expect(errors).toContain("Splits exceed 100%"));
  expect(created).toEqual(["Variant B"]);
  expect(await screen.findByText("Published 1 variant")).toBeTruthy();
  expect(screen.getByDisplayValue("Variant C")).toBeTruthy();
  expect(screen.queryByDisplayValue("Variant B")).toBeNull();
});

it("warns that staged variants are lost on refresh", async () => {
  renderTab();
  fireEvent.click(await screen.findByRole("button", { name: "Add variant" }));

  expect(
    screen.getByText(
      /exist only in this browser.*refreshing the page discards/,
    ),
  ).toBeTruthy();
});

it("blocks publishing while the splits total more than 100%", async () => {
  renderTab();
  fireEvent.click(await screen.findByRole("button", { name: "Add variant" }));
  fireEvent.change(screen.getByLabelText("Split of staged variant Variant B"), {
    target: { value: "80" },
  });

  expect(screen.getByText(/over the 100% limit/)).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Publish drafts (1)" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("offers Add variant only once the task has a form", async () => {
  renderTab(null);

  expect(
    (await screen.findByRole("button", { name: "Add variant" })).hasAttribute(
      "disabled",
    ),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Form tab" }));
  expect(openedTabs).toEqual(["form"]);
});

it("keeps the staged drafts on screen when the reload after a publish fails", async () => {
  renderTab();
  const add = await screen.findByRole("button", { name: "Add variant" });
  fireEvent.click(add);
  fireEvent.click(add);
  loadStatus = 500;

  fireEvent.click(screen.getByRole("button", { name: "Publish drafts (2)" }));

  await waitFor(() => expect(errors).toContain("Splits exceed 100%"));
  expect(screen.getByDisplayValue("Variant C")).toBeTruthy();
  expect(screen.getByDisplayValue("Variant A")).toBeTruthy();
});

it("shows the server's refusal of an edit and keeps the edit", async () => {
  writeStatus = 409;
  renderTab();
  fireEvent.change(await screen.findByDisplayValue("Variant A"), {
    target: { value: "Renamed" },
  });

  fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

  await waitFor(() => expect(errors).toContain("Variant is locked"));
  expect(screen.getByDisplayValue("Renamed")).toBeTruthy();
});

it("enables Save only for a changed variant", async () => {
  renderTab();
  const save = await screen.findByRole("button", { name: /^Save/ });
  expect(save.hasAttribute("disabled")).toBe(true);

  fireEvent.change(screen.getByDisplayValue("Variant A"), {
    target: { value: "Renamed" },
  });
  expect(save.hasAttribute("disabled")).toBe(false);
});

it("asks before deleting, saying what happens before and after launch, and shows the refusal", async () => {
  renderTab();

  fireEvent.click(await screen.findByRole("button", { name: /^Delete/ }));

  expect(await screen.findByText(/takes effect, and while/)).toBeTruthy();
  expect(
    screen.getByText(/refuses to delete it while any member/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete variant" }));

  await waitFor(() => expect(errors).toContain("Users are assigned"));
  expect(screen.getByDisplayValue("Variant A")).toBeTruthy();
});

it("deletes nothing when the confirmation is declined", async () => {
  renderTab();

  fireEvent.click(await screen.findByRole("button", { name: /^Delete/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

  expect(errors).toEqual([]);
});
