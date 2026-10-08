import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  openSection,
  selectElement,
  settings,
} from "../lib/testing/formCanvas";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

afterEach(cleanup);

const shownWhenQ: VisibleIfFormula = {
  conditions: { c1: { kind: "hasValue", when: "q", hasValue: true } },
  formula: "c1",
};
const q: PageItem = {
  id: "q",
  type: "input",
  kind: "text",
  label: "Q",
  output: { output: true },
};
const schemaWith = (
  fields: PageItem[],
  rest: Partial<FormSchema> = {},
): FormSchema => ({
  pages: [{ id: "p1", title: "One", fields: [q, ...fields] }],
  outputViews: [],
  aggregateViews: [],
  ...rest,
});

const expressions = () =>
  screen.queryAllByRole<HTMLTextAreaElement>("textbox", { name: "Expression" });
const editAsExpression = () =>
  fireEvent.click(
    screen.getAllByRole("button", { name: "Edit as expression" })[0]!,
  );
const typeExpression = async (value: string) => {
  fireEvent.change(expressions()[0]!, { target: { value } });
  await act(async () => {});
};

const twoPagesWith = (fields: PageItem[]): FormSchema => ({
  ...schemaWith([]),
  pages: [
    { id: "p1", title: "One", fields: [q, ...fields] },
    { id: "p2", title: "Two", fields: [] },
  ],
});
const revisit = (away: string, back: string) => {
  fireEvent.click(screen.getByRole("button", { name: away }));
  fireEvent.click(screen.getByRole("button", { name: back }));
};

it("gives each list sub-field its own expression text", async () => {
  renderFormBuilder(
    schemaWith([
      {
        id: "list",
        type: "input",
        kind: "list",
        label: "People",
        fields: [
          {
            id: "s1",
            type: "input",
            kind: "text",
            label: "First",
            visibleIfFormula: shownWhenQ,
          },
          {
            id: "s2",
            type: "input",
            kind: "text",
            label: "Second",
            visibleIfFormula: shownWhenQ,
          },
        ],
      },
    ]),
  );
  const selectSubField = (label: string) => {
    selectElement("People");
    fireEvent.click(
      settings().getByRole("button", { name: `Text Field: ${label}` }),
    );
    openSection("Conditions");
  };
  selectSubField("First");
  editAsExpression();
  await typeExpression("c1 AND");
  selectSubField("Second");
  editAsExpression();
  expect(expressions().map((box) => box.value)).toEqual(["c1"]);

  selectSubField("First");
  expect(expressions().map((box) => box.value)).toEqual(["c1 AND"]);
});

it("keeps an output block's expression text across tabs", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  renderFormBuilder(
    schemaWith([], {
      outputViews: [
        {
          type: "default",
          id: "view-1",
          blocks: [
            { id: "block-1", fieldId: "q", visibleIfFormula: shownWhenQ },
          ],
        },
      ],
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Output View" }));
  editAsExpression();
  await typeExpression("c1 AND");

  fireEvent.click(screen.getByRole("button", { name: "Shareable Text" }));
  fireEvent.click(screen.getByRole("button", { name: "Output View" }));
  expect(expressions().map((box) => box.value)).toEqual(["c1 AND"]);
});

it("shows the pasted formula as rules after Apply JSON, not stale typed text", async () => {
  const schema = schemaWith([
    {
      id: "a",
      type: "input",
      kind: "text",
      label: "A",
      visibleIfFormula: shownWhenQ,
    },
  ]);
  renderFormBuilder(schema);
  selectElement("A");
  openSection("Conditions");
  editAsExpression();
  await typeExpression("c1 AND");

  const pasted = structuredClone(schema);
  pasted.pages[0]!.fields[1]!.visibleIfFormula = {
    conditions: {
      ...shownWhenQ.conditions,
      c2: { kind: "hasValue", when: "q", hasValue: false },
    },
    formula: {
      op: "AND",
      left: "c1",
      right: { op: "NOT", operand: "c2" },
    },
  };
  fireEvent.click(screen.getByRole("button", { name: "Edit form JSON" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Form JSON" }), {
    target: { value: JSON.stringify(pasted) },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  });

  expect(expressions().map((box) => box.value)).toEqual([]);
});

it("keeps an id-less block's text out of history, for only as long as it is mounted", async () => {
  renderFormBuilder(
    twoPagesWith([
      {
        type: "display",
        kind: "text",
        text: "A",
        visibleIfFormula: shownWhenQ,
      },
    ]),
  );
  const openBlockConditions = () => {
    selectElement("Text Block: A");
    openSection("Conditions");
  };
  openBlockConditions();
  editAsExpression();
  await typeExpression("c1 AND");
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Undo" }).disabled,
  ).toBe(true);

  revisit("Two", "One");
  openBlockConditions();
  expect(expressions().map((box) => box.value)).toEqual([]);
});

/**
 * Text typed before any rule saves no formula, so only the toggle decides
 * whether it shows: it reopens the toggle, and turning the toggle off drops it.
 */
const expectToggleKeepsThenDropsText = async ({
  toggle,
  revisitEditor,
}: {
  toggle: () => void;
  revisitEditor: () => void;
}) => {
  toggle();
  editAsExpression();
  await typeExpression("c9");

  revisitEditor();
  expect(expressions().map((box) => box.value)).toEqual(["c9"]);
  toggle();
  toggle();
  expect(expressions().map((box) => box.value)).toEqual([]);
};

/**
 * Text typed before any rule saves no formula, so it stays in the sidebar's
 * Conditions on every visit until all conditions are removed.
 */
const expectRuleLessTextKeptUntilRemoved = async ({
  openConditions,
  revisitEditor,
}: {
  openConditions: () => void;
  revisitEditor: () => void;
}) => {
  openConditions();
  editAsExpression();
  await typeExpression("c9");

  revisitEditor();
  openConditions();
  expect(expressions().map((box) => box.value)).toEqual(["c9"]);
  fireEvent.click(
    screen.getByRole("button", { name: "Remove all conditions" }),
  );
  expect(expressions().map((box) => box.value)).toEqual([]);
  revisitEditor();
  openConditions();
  expect(expressions().map((box) => box.value)).toEqual([]);
};

it("keeps a page's rule-less text until its conditions are removed", async () => {
  renderFormBuilder(twoPagesWith([]));
  fireEvent.click(screen.getByRole("button", { name: "Two" }));
  await expectRuleLessTextKeptUntilRemoved({
    openConditions: () => openSection("Conditions"),
    revisitEditor: () => revisit("One", "Two"),
  });
});

it("keeps a question's rule-less text until its conditions are removed", async () => {
  renderFormBuilder(
    twoPagesWith([{ id: "a", type: "input", kind: "text", label: "A" }]),
  );
  await expectRuleLessTextKeptUntilRemoved({
    openConditions: () => {
      selectElement("A");
      openSection("Conditions");
    },
    revisitEditor: () => revisit("Two", "One"),
  });
});

it("keeps a display block's rule-less text until its conditions are removed", async () => {
  renderFormBuilder(
    twoPagesWith([{ id: "b", type: "display", kind: "text", text: "B" }]),
  );
  await expectRuleLessTextKeptUntilRemoved({
    openConditions: () => {
      selectElement("Text Block: B");
      openSection("Conditions");
    },
    revisitEditor: () => revisit("Two", "One"),
  });
});

it("keeps an output block's rule-less text behind its toggle until turned off", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  renderFormBuilder(
    schemaWith([], {
      outputViews: [
        {
          type: "default",
          id: "view-1",
          blocks: [{ id: "block-1", fieldId: "q" }],
        },
      ],
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Output View" }));
  await expectToggleKeepsThenDropsText({
    toggle: () =>
      fireEvent.click(screen.getByLabelText("Conditional visibility")),
    revisitEditor: () => revisit("Shareable Text", "Output View"),
  });
});
