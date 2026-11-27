import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { expect, it } from "bun:test";
import {
  renderFormBuilder,
  renderSavedFormBuilder,
} from "../../../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [{ id: "p1", title: "One", fields: [] }],
  outputViews: [],
  aggregateViews: [],
};

let releaseLoad = () => {};
serveApi(
  routes(
    {
      "GET /tasks/adminForm/:id": () =>
        new Promise<Response>((resolve) => {
          releaseLoad = () =>
            resolve(
              Response.json({
                id: 1,
                schema: {
                  ...schema,
                  variables: [{ name: "n", inputs: {}, formula: "1" }],
                },
                formSnapshotId: 3,
              }),
            );
        }),
    },
    () => Response.json([]),
  ),
);

it("keeps focus on the editor tab it switches to, and back", async () => {
  renderFormBuilder(schema);
  for (const name of ["Formulas", "Output views", "Rows", "Form"]) {
    const tab = screen.getByRole("tab", { name });
    tab.focus();
    await act(async () => fireEvent.click(tab));
    expect(screen.getByRole("tab", { name })).toBe(tab);
    expect(document.activeElement).toBe(tab);
  }
});

it("lays out the formula count and says nothing of issues until the form loads", async () => {
  renderSavedFormBuilder(1, "/");
  const formulas = await screen.findByRole("tab", { name: "Formulas" });
  const countSlot = formulas.querySelector("[aria-hidden]");
  expect(countSlot?.classList.contains("invisible")).toBe(true);
  expect(screen.queryByText("No issues")).toBeNull();

  await act(async () => releaseLoad());
  expect(await screen.findByRole("tab", { name: "Formulas 1" })).toBe(formulas);
  expect(within(formulas).getByText("1").closest("[aria-hidden]")).toBe(
    countSlot,
  );
  expect(screen.getByText("No issues")).toBeTruthy();
});
