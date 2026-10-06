import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import z from "zod";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";
import { resetCustomValidatorsCache } from "./form-fields/CommonControls";

afterEach(cleanup);

const twoPages: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "q", type: "input", kind: "text", label: "Q" },
        {
          id: "a",
          type: "input",
          kind: "text",
          label: "A",
          visibleIfFormula: {
            conditions: { c1: { kind: "hasValue", when: "q", hasValue: true } },
            formula: "c1",
          },
        },
      ],
    },
    { id: "p2", title: "Two", fields: [] },
  ],
  outputViews: [],
  aggregateViews: [],
};

const saved: FormSchema[] = [];
let validatorsCreated = 0;
let conflictsLeft = 0;
let saveGate: Promise<void> = Promise.resolve();
serveApi(
  routes(
    {
      "GET /tasks/customValidators": () =>
        Response.json([
          {
            name: "Has phone number",
            id: "HasPhoneNumber",
            withIdField: false,
            usableForVisibility: true,
          },
        ]),
      "POST /tasks/createCustomValidator": () => {
        validatorsCreated += 1;
        return Response.json({ id: 42 });
      },
      "GET /tasks/findOneCustomValidator/:id": () =>
        Response.json({
          id: 42,
          type: "HasPhoneNumber",
          idArgument: null,
          expression: null,
        }),
      "PUT /tasks/updateForm/:formId": async ({ request }) => {
        await saveGate;
        if (conflictsLeft > 0) {
          conflictsLeft -= 1;
          return new Response(null, { status: 409 });
        }
        saved.push(
          z.object({ schema: formSchema }).parse(await request.json()).schema,
        );
        return Response.json({ id: 1, formSnapshotId: 2 });
      },
      "GET /contract/current": () =>
        Response.json({ id: 7, name: "Pledge", markdown: "I pledge" }),
      "GET /contract/admin": () =>
        Response.json([{ id: 7, name: "Pledge", markdown: "I pledge" }]),
      "GET /tasks/slug/:id": () =>
        Response.json({
          id: 1,
          schema: { ...twoPages, description: "Theirs" },
          formSnapshotId: 3,
        }),
    },
    () => Response.json([]),
  ),
);

beforeEach(() => {
  saved.length = 0;
  validatorsCreated = 0;
  conflictsLeft = 0;
  saveGate = Promise.resolve();
  resetCustomValidatorsCache();
});

/** Lets the edit before it finish its task, as a separate event would. */
const nextTask = () => act(async () => {});
const button = (name: string) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const pageTitle = () =>
  screen.getByPlaceholderText<HTMLInputElement>("Page title");
const save = () =>
  act(async () => {
    fireEvent.click(button("Save Form"));
  });

it("starts with nothing to undo, then steps back through edits on every tab", async () => {
  // Switching tabs with unsaved changes asks before leaving.
  jest.spyOn(window, "confirm").mockReturnValue(true);
  renderFormBuilder(twoPages, 1);
  expect(button("Undo").disabled).toBe(true);
  expect(button("Redo").disabled).toBe(true);

  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await nextTask();
  fireEvent.click(screen.getByText("Shareable Text"));
  const placeholder = "Example: Join me in taking this action.";
  const template = () =>
    screen.getByPlaceholderText<HTMLTextAreaElement>(placeholder);
  fireEvent.change(await screen.findByPlaceholderText(placeholder), {
    target: { value: "Join" },
  });
  await nextTask();

  fireEvent.click(button("Undo"));
  expect(template().value).toBe("");
  fireEvent.click(screen.getByText("Form Builder"));
  expect(
    (await screen.findByPlaceholderText<HTMLInputElement>("Page title")).value,
  ).toBe("First");
  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("One");
  expect(button("Undo").disabled).toBe(true);

  fireEvent.click(button("Redo"));
  expect(pageTitle().value).toBe("First");
});

it("folds typing into one step until the field loses focus", async () => {
  renderFormBuilder(twoPages, 1);
  const type = async (value: string) => {
    fireEvent.change(pageTitle(), { target: { value } });
    await nextTask();
  };

  act(() => pageTitle().focus());
  await type("On");
  await type("O");
  act(() => button("Save Form").focus());
  act(() => pageTitle().focus());
  await type("Ox");

  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("O");
  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("One");
});

it("keeps redo through a write that changes nothing", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  renderFormBuilder(
    {
      ...twoPages,
      aggregateViews: [
        {
          kind: "progressbar",
          id: "agg",
          title: "",
          caption: "",
          numerator: { type: "number", value: 1 },
          denominator: { type: "number", value: 2 },
          displayType: "number",
        },
      ],
    },
    1,
  );
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await nextTask();
  fireEvent.click(button("Undo"));

  fireEvent.click(button("Aggregate Views"));
  fireEvent.blur(screen.getAllByRole("spinbutton")[0]!);
  await nextTask();
  expect(button("Redo").disabled).toBe(false);
});

it("undoes on ⌘Z outside a text field, leaving typing's undo to the browser", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await nextTask();

  fireEvent.keyDown(pageTitle(), { key: "z", metaKey: true });
  expect(pageTitle().value).toBe("First");
  fireEvent.keyDown(document.body, { key: "z", metaKey: true });
  expect(pageTitle().value).toBe("One");
  fireEvent.keyDown(document.body, { key: "z", metaKey: true, shiftKey: true });
  expect(pageTitle().value).toBe("First");
  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
  expect(pageTitle().value).toBe("One");
  fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
  expect(pageTitle().value).toBe("First");
  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
  fireEvent.keyDown(document.body, { key: "y", metaKey: true });
  expect(pageTitle().value).toBe("One");
});

it("leaves ⌘Z outside the builder alone", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await nextTask();
  const outside = document.createElement("button");
  document.body.append(outside);

  fireEvent.keyDown(outside, { key: "z", metaKey: true });
  expect(pageTitle().value).toBe("First");
  outside.remove();
});

it("leaves ⌘Z inside a dialog to the dialog", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await nextTask();
  fireEvent.click(button("Edit form JSON"));

  fireEvent.keyDown(button("Apply"), { key: "z", metaKey: true });
  fireEvent.click(button("Cancel"));
  expect(pageTitle().value).toBe("First");
});

it("undoes an Apply JSON like any other edit", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(button("Edit form JSON"));
  const renamed = structuredClone(twoPages);
  renamed.pages[0]!.title = "Pasted";
  fireEvent.change(screen.getByRole("textbox", { name: "Form JSON" }), {
    target: { value: JSON.stringify(renamed) },
  });
  await act(async () => {
    fireEvent.click(button("Apply"));
  });
  expect(pageTitle().value).toBe("Pasted");

  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("One");
});

it("keeps history through a save, and undoing past it leaves changes to save", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await save();
  await screen.findByRole("button", { name: "No changes" });

  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("One");
  expect(button("Save Form").disabled).toBe(false);
  fireEvent.click(button("Redo"));
  expect(button("No changes").disabled).toBe(true);
});

it("ends the step on save, so undo stops at the saved text", async () => {
  renderFormBuilder(twoPages, 1);
  act(() => pageTitle().focus());
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await save();
  await screen.findByRole("button", { name: "No changes" });
  fireEvent.change(pageTitle(), { target: { value: "Firstx" } });
  await nextTask();

  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("First");
});

it("locks undo while a save is in flight", async () => {
  let releaseSave = () => {};
  saveGate = new Promise((resolve) => {
    releaseSave = resolve;
  });
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await nextTask();
  await save();

  expect(button("Undo").disabled).toBe(true);
  fireEvent.keyDown(document.body, { key: "z", metaKey: true });
  expect(pageTitle().value).toBe("First");
  await act(async () => releaseSave());
  await waitFor(() => expect(button("Undo").disabled).toBe(false));
});

it("closes the copy picker on undo, since its position may no longer hold", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await nextTask();
  fireEvent.click(button("Copy Existing Element"));
  expect(screen.queryByText("Choose an element to copy…")).not.toBeNull();

  fireEvent.click(button("Undo"));
  expect(screen.queryByText("Choose an element to copy…")).toBeNull();
});

it("keeps history when Keep mine saves over theirs", async () => {
  conflictsLeft = 1;
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await save();
  await act(async () => {
    fireEvent.click(await screen.findByText("Keep mine (overwrite theirs)"));
  });
  await waitFor(() => expect(saved).toHaveLength(1));

  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("One");
});

it("starts a new history from their version after Take theirs", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  conflictsLeft = 1;
  renderFormBuilder(twoPages, 1);
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await save();
  await act(async () => {
    fireEvent.click(await screen.findByText("Take theirs"));
  });

  expect(pageTitle().value).toBe("One");
  expect(button("Undo").disabled).toBe(true);
});

it("creates a draft validator once, whatever is undone and redone after", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Extra form options" })[0]!,
  );
  fireEvent.click(screen.getByLabelText("Use custom validator"));
  const option = await screen.findByRole("option", {
    name: "Has phone number",
  });
  fireEvent.change(option.closest("select")!, {
    target: { value: "HasPhoneNumber" },
  });
  await nextTask();
  await save();
  await waitFor(() => expect(saved).toHaveLength(1));

  fireEvent.click(button("Undo"));
  fireEvent.click(button("Redo"));
  fireEvent.change(pageTitle(), { target: { value: "First" } });
  await save();
  await waitFor(() => expect(saved).toHaveLength(2));

  expect(validatorsCreated).toBe(1);
  const [question] = saved[1]!.pages[0]!.fields;
  expect(question && "customValidatorId" in question).toBe(true);
  expect(question?.type === "input" && question.customValidatorId).toBe(42);
});

it("reopens the Output View's expression editor when undo restores its text", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  renderFormBuilder(
    {
      ...twoPages,
      pages: [
        {
          id: "p1",
          title: "One",
          fields: [
            {
              id: "q",
              type: "input",
              kind: "text",
              label: "Q",
              output: { output: true },
            },
          ],
        },
      ],
      outputViews: [
        {
          type: "default",
          id: "view-1",
          blocks: [
            {
              id: "block-1",
              fieldId: "q",
              visibleIfFormula: {
                conditions: {
                  c1: { kind: "hasValue", when: "q", hasValue: true },
                },
                formula: "c1",
              },
            },
          ],
        },
      ],
    },
    1,
  );
  fireEvent.click(button("Output View"));
  fireEvent.click(button("Edit as expression"));
  const expression = () =>
    screen.queryByRole<HTMLTextAreaElement>("textbox", { name: "Expression" });
  fireEvent.change(expression()!, { target: { value: "c1 AND" } });
  await nextTask();
  fireEvent.click(button("All rules"));
  expect(expression()).toBeNull();

  fireEvent.click(button("Undo"));
  expect(expression()?.value).toBe("c1 AND");
});

it("keeps unsaved expression text across pages, and undoes it", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(button("Edit as expression"));
  const expression = () =>
    screen.queryByRole<HTMLTextAreaElement>("textbox", { name: "Expression" });
  fireEvent.change(expression()!, { target: { value: "c1 AND" } });
  await nextTask();

  fireEvent.click(screen.getByRole("button", { name: "Two" }));
  fireEvent.click(screen.getByRole("button", { name: "One" }));
  expect(expression()?.value).toBe("c1 AND");

  fireEvent.click(button("Undo"));
  expect(expression()).toBeNull();
});

it("drops expression text on returning to all/any rules", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(button("Edit as expression"));
  const expression = () =>
    screen.queryByRole<HTMLTextAreaElement>("textbox", { name: "Expression" });
  fireEvent.change(expression()!, { target: { value: "c1 AND" } });
  fireEvent.change(expression()!, { target: { value: "c1" } });
  fireEvent.click(button("Use all/any rules"));

  fireEvent.click(screen.getByRole("button", { name: "Two" }));
  fireEvent.click(screen.getByRole("button", { name: "One" }));
  expect(expression()).toBeNull();
});

it("undoes a contract question with the contract it defaults to", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(screen.getByRole("button", { name: "Contract Field" }));
  await screen.findByDisplayValue("Pledge");
  await nextTask();

  fireEvent.click(button("Undo"));
  await nextTask();
  expect(screen.queryByDisplayValue("Sign the contract?")).toBeNull();
  expect(button("Undo").disabled).toBe(true);
});

it("stays at the position of a page undo removes, or the last page past the end", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(button("Copy One"));
  expect(pageTitle().value).toBe("One (Copy)");
  await nextTask();
  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("Two");

  fireEvent.click(button("Copy Two"));
  expect(pageTitle().value).toBe("Two (Copy)");
  await nextTask();
  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("Two");
});

it("keeps the page on screen when undo removes a page before it", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(button("Copy One"));
  await nextTask();
  fireEvent.click(screen.getByRole("button", { name: "Two" }));

  fireEvent.click(button("Undo"));
  expect(pageTitle().value).toBe("Two");
  fireEvent.click(button("Redo"));
  expect(pageTitle().value).toBe("Two");
});

it("restores a draft validator that was turned off, and creates it on Save", async () => {
  renderFormBuilder(twoPages, 1);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Extra form options" })[0]!,
  );
  const toggle = () =>
    screen.getByLabelText<HTMLInputElement>("Use custom validator");
  fireEvent.click(toggle());
  const option = await screen.findByRole("option", {
    name: "Has phone number",
  });
  fireEvent.change(option.closest("select")!, {
    target: { value: "HasPhoneNumber" },
  });
  await nextTask();
  fireEvent.click(toggle());
  await nextTask();
  expect(toggle().checked).toBe(false);

  fireEvent.click(button("Undo"));
  fireEvent.click(
    screen.getAllByRole("button", { name: "Extra form options" })[0]!,
  );
  expect(toggle().checked).toBe(true);
  await save();
  await waitFor(() => expect(saved).toHaveLength(1));
  expect(validatorsCreated).toBe(1);
  const [question] = saved[0]!.pages[0]!.fields;
  expect(question?.type === "input" && question.customValidatorId).toBe(42);
});

it("adds no step for a custom component's default component", async () => {
  renderFormBuilder(
    {
      ...twoPages,
      pages: [
        {
          id: "p1",
          title: "One",
          fields: [
            {
              id: "c",
              type: "input",
              kind: "custom",
              label: "C",
              componentId: "",
            },
          ],
        },
      ],
    },
    1,
  );
  await nextTask();
  expect(button("Undo").disabled).toBe(true);
});
