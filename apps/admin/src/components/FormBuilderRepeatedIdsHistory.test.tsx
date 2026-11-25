import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, screen } from "@testing-library/react";
import {
  fromSelectionMenu,
  heading,
  openSection,
  selectElement,
} from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

const twins: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "twin", type: "input", kind: "text", label: "First" },
        { id: "twin", type: "input", kind: "text", label: "Second" },
        { id: "third", type: "input", kind: "text", label: "Third" },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

/** Lets the edit before it finish its task, as a separate event would. */
const nextTask = () => act(async () => {});
const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });

it("returns the selection to its element through undo when another shares its id", async () => {
  renderFormBuilder(twins);
  selectElement("Second");
  fromSelectionMenu("Move down");
  await nextTask();
  fireEvent.click(button("Undo"));
  expect(heading()).toBe("Text Field: Second");
});

it("brings the selection back to a deleted element through undo and redo when another shares its id", async () => {
  renderFormBuilder(twins);
  selectElement("Second");
  openSection("Advanced");
  fromSelectionMenu("Delete question");
  await nextTask();
  fireEvent.click(button("Undo"));
  expect(heading()).toBe("Text Field: Second");
  fireEvent.click(button("Redo"));
  fireEvent.click(button("Undo"));
  expect(heading()).toBe("Text Field: Second");
});

it("brings the selection back to the first of two elements sharing an id once it is deleted and restored", async () => {
  renderFormBuilder(twins);
  selectElement("First");
  openSection("Advanced");
  fromSelectionMenu("Delete question");
  await nextTask();
  fireEvent.click(button("Undo"));
  expect(heading()).toBe("Text Field: First");
});

it("returns the selection to a deleted element through undo after its twin moved", async () => {
  renderFormBuilder(twins);
  selectElement("Second");
  openSection("Advanced");
  fromSelectionMenu("Delete question");
  await nextTask();
  expect(heading()).toBe("Text Field: First");
  fromSelectionMenu("Move down");
  await nextTask();
  fireEvent.click(button("Undo"));
  fireEvent.click(button("Undo"));
  expect(heading()).toBe("Text Field: Second");
});
