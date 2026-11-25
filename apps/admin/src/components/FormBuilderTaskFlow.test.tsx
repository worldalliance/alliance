import type { FormSchema } from "@alliance/common/forms/form-schema";
import { taskFlowFallbackTitle } from "@alliance/shared/lib/copy";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { screen } from "@testing-library/react";
import {
  renderFormBuilder,
  renderSavedFormBuilder,
  renderTaskFormBuilder,
} from "../lib/testing/renderFormBuilder";

serveApi(
  routes(
    {
      "GET /tasks/adminForm/:id": ({ params }) =>
        Response.json({
          id: Number(params.id),
          schema,
          formSnapshotId: 3,
          usedInAction:
            params.id === "2" ? undefined : { id: 5, name: "Oat milk" },
        }),
    },
    () => Response.json([]),
  ),
);

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: ["a", "b", "c"].map((id) => ({
        id,
        type: "input",
        kind: "text",
        label: id,
      })),
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const stepLabel = `Step 1: ${taskFlowFallbackTitle.questions}`;

it("shows a task form's page as its task flow step, with what to fix", () => {
  renderTaskFormBuilder(schema);
  expect(screen.getByText(stepLabel)).toBeTruthy();
  expect(screen.getByText(/^No header block/)).toBeTruthy();
  expect(screen.getByText(/^3 questions on one step/)).toBeTruthy();
});

it("leaves step notes off forms that aren't task forms", () => {
  renderFormBuilder(schema);
  expect(screen.queryByText(stepLabel)).toBeNull();
});

it("shows step notes on a saved form the server names an action for", async () => {
  renderSavedFormBuilder(1, "/");
  expect(await screen.findByText(stepLabel)).toBeTruthy();
});

it("leaves step notes off a saved form no action uses", async () => {
  renderSavedFormBuilder(2, "/");
  expect(await screen.findByText("Text Field: a")).toBeTruthy();
  expect(screen.queryByText(stepLabel)).toBeNull();
});
