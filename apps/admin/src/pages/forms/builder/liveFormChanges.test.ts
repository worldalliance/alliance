import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import { describe, expect, it } from "bun:test";
import {
  describeLiveChanges,
  LiveChangeKind,
  liveFormChanges,
} from "./liveFormChanges";

const form = (...fields: AnyField[]): FormSchema => ({
  pages: [{ id: "p1", title: "One", fields }],
  outputViews: [],
  aggregateViews: [],
});

const radio = (options: string[]): AnyField => ({
  id: "q",
  type: "input",
  kind: "radio",
  label: "Pick one",
  options: options.map((value) => ({ label: value.toUpperCase(), value })),
});

const text = (id: string, label = "Name"): AnyField => ({
  id,
  type: "input",
  kind: "text",
  label,
});

describe("liveFormChanges", () => {
  it("finds a removed question, which is also how a changed id shows", () => {
    expect(liveFormChanges(form(text("a")), form(text("b")))).toEqual([
      {
        kind: LiveChangeKind.QuestionRemoved,
        questionId: "a",
        questionLabel: "Name",
        detail: null,
      },
    ]);
  });

  it("finds a question whose kind changed", () => {
    const number: AnyField = {
      id: "a",
      type: "input",
      kind: "number",
      label: "Name",
    };
    expect(liveFormChanges(form(text("a")), form(number))).toEqual([
      {
        kind: LiveChangeKind.KindChanged,
        questionId: "a",
        questionLabel: "Name",
        detail: "from Text Field to Number Field",
      },
    ]);
  });

  it("finds a removed option by its value", () => {
    expect(
      liveFormChanges(form(radio(["yes", "no"])), form(radio(["yes"]))),
    ).toEqual([
      {
        kind: LiveChangeKind.OptionRemoved,
        questionId: "q",
        questionLabel: "Pick one",
        detail: '"NO" (no)',
      },
    ]);
  });

  it("finds range values cut off by fewer options", () => {
    const range = (optionCount: number): AnyField => ({
      id: "r",
      type: "input",
      kind: "range",
      label: "Score",
      optionCount,
    });
    expect(
      liveFormChanges(form(range(5)), form(range(3))).map(
        ({ detail }) => detail,
      ),
    ).toEqual(['"4" (4)', '"5" (5)']);
  });

  it("finds a removed list sub-field", () => {
    const list = (fields: AnyField[]): AnyField => ({
      id: "l",
      type: "input",
      kind: "list",
      label: "Pets",
      fields: fields.flatMap((field) => (field.kind === "text" ? [field] : [])),
    });
    expect(
      liveFormChanges(form(list([text("n", "Pet name")])), form(list([]))),
    ).toEqual([
      {
        kind: LiveChangeKind.QuestionRemoved,
        questionId: "n",
        questionLabel: "Pet name",
        detail: null,
      },
    ]);
  });

  it("ignores copy, added questions and options, and required", () => {
    const before = form(radio(["yes"]));
    const after = form(
      { ...radio(["yes", "no"]), label: "Choose", required: true },
      text("new"),
    );
    expect(liveFormChanges(before, after)).toEqual([]);
  });

  it("doesn't compare options a formula gives", () => {
    const select = (formula: boolean): AnyField => ({
      id: "s",
      type: "input",
      kind: "select",
      label: "Pick",
      options: formula ? [] : [{ label: "A", value: "a" }],
      ...(formula && { optionsFormula: { formula: "[]", inputs: {} } }),
    });
    expect(liveFormChanges(form(select(false)), form(select(true)))).toEqual(
      [],
    );
  });
});

describe("describeLiveChanges", () => {
  it("says each change in a line and counts what it leaves out", () => {
    const changes = Array.from({ length: 12 }, (_, index) => ({
      kind: LiveChangeKind.QuestionRemoved,
      questionId: `q${index}`,
      questionLabel: `Question ${index}`,
      detail: null,
    }));
    const lines = describeLiveChanges(changes);
    expect(lines[0]).toBe('• Removes the question "Question 0" (q0)');
    expect(lines).toHaveLength(11);
    expect(lines[10]).toBe("…and 2 more");
  });
});
