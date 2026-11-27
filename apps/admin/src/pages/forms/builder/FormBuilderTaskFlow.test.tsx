import type { FormSchema } from "@alliance/common/forms/form-schema";
import { taskFlowFallbackTitle } from "@alliance/shared/lib/copy";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen } from "@testing-library/react";
import { fromMainMenu } from "../../../lib/testing/formCanvas";
import {
  renderFormBuilder,
  renderTaskFormBuilder,
} from "../../../lib/testing/renderFormBuilder";

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
  expect(screen.getByText(/^3 questions on one step/)).toBeTruthy();
});

it("leaves step notes off forms that aren't task forms", () => {
  renderFormBuilder(schema);
  expect(screen.queryByText(stepLabel)).toBeNull();
});

const outlineToggle = /Show the step outline on the task card/;

it("lets a task form turn its card's step outline off and back on", () => {
  renderTaskFormBuilder(schema);
  fromMainMenu("Form settings");
  const toggle = screen.getByRole<HTMLInputElement>("checkbox", {
    name: outlineToggle,
  });
  expect(toggle.checked).toBe(true);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(false);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(true);
});

it("offers no outline setting on forms that aren't task forms", () => {
  renderFormBuilder(schema);
  fromMainMenu("Form settings");
  expect(screen.queryByRole("checkbox", { name: outlineToggle })).toBeNull();
});
