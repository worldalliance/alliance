import type { FormSchema } from "@alliance/common/forms/form-schema";
import { taskFlowFallbackTitle } from "@alliance/shared/lib/copy";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { screen } from "@testing-library/react";
import {
  renderFormBuilder,
  renderTaskFormBuilder,
} from "../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

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
  expect(screen.getByText(/^3 inputs on one step/)).toBeTruthy();
});

it("leaves step notes off forms that aren't task forms", () => {
  renderFormBuilder(schema);
  expect(screen.queryByText(stepLabel)).toBeNull();
});
