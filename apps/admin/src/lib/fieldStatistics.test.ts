import type { AnyField } from "@alliance/common/forms/form-schema";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { buildFieldStats } from "./fieldStatistics";

const responses = (answers: unknown[]) =>
  answers.map((answer, index) =>
    makeFormResponse({ id: index + 1, answers: { q: answer } }),
  );

it("counts checked, unchecked, and unanswered checkboxes", () => {
  const field: AnyField = {
    id: "q",
    type: "input",
    kind: "checkbox",
    label: "Agree",
  };
  const stats = buildFieldStats(field, responses([true, "false", null]), 3);
  expect(stats.rows.map(({ key, count }) => [key, count])).toEqual([
    ["checked", 1],
    ["unchecked", 1],
    ["no-response", 1],
  ]);
  expect(stats.answeredCount).toBe(2);
});

it.each(["select", "radio"] as const)(
  "counts %s options and flags answers outside them",
  (kind) => {
    const field: AnyField = {
      id: "q",
      type: "input",
      kind,
      label: "Pick",
      options: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
    };
    const stats = buildFieldStats(field, responses(["a", "a", "z", ""]), 4);
    expect(stats.rows).toEqual([
      {
        key: "a",
        label: "A",
        count: 2,
        useMarkdown: true,
        filter: { fieldId: "q", op: "equals", value: "a" },
      },
      {
        key: "b",
        label: "B",
        count: 0,
        useMarkdown: true,
        filter: { fieldId: "q", op: "equals", value: "b" },
      },
      { key: "unknown-option", label: "Unknown option", count: 1 },
      {
        key: "no-response",
        label: "No response",
        count: 1,
        filter: { fieldId: "q", op: "no-response" },
      },
    ]);
    expect(stats.answeredCount).toBe(3);
  },
);

it("counts each multiselect choice and each response with an unknown one once", () => {
  const field: AnyField = {
    id: "q",
    type: "input",
    kind: "multiselect",
    label: "Pick",
    options: [{ label: "A", value: "a" }],
  };
  const stats = buildFieldStats(
    field,
    responses([["a", "x", "y"], "a", []]),
    3,
  );
  expect(stats.rows.map(({ key, count }) => [key, count])).toEqual([
    ["a", 2],
    ["unknown-option", 1],
    ["no-response", 1],
  ]);
  expect(stats.answeredCount).toBe(2);
});

it("counts range answers per step and notes the scale labels", () => {
  const field: AnyField = {
    id: "q",
    type: "input",
    kind: "range",
    label: "Rate",
    optionCount: 3,
    startLabel: "Low",
  };
  const stats = buildFieldStats(field, responses([1, "3", 9, " "]), 4);
  expect(stats.rows.map(({ key, count }) => [key, count])).toEqual([
    ["1", 1],
    ["2", 0],
    ["3", 1],
    ["unknown-option", 1],
    ["no-response", 1],
  ]);
  expect(stats.note).toBe("Scale: Low to end");
});

it("summarizes number answers, skipping ones that aren't finite numbers", () => {
  const field: AnyField = {
    id: "q",
    type: "input",
    kind: "number",
    label: "How many",
  };
  const stats = buildFieldStats(field, responses([2, "4", "abc", null]), 4);
  expect(stats.answeredCount).toBe(2);
  expect(stats.summary).toEqual({
    min: 2,
    max: 4,
    avg: 3,
    median: 3,
    total: 6,
  });
});
