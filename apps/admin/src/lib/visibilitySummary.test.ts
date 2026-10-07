import type { AnyField } from "@alliance/common/forms/form-schema";
import { UserValueProperty } from "@alliance/common/forms/user-properties";
import {
  SelectedCountComparison,
  type Condition,
} from "@alliance/common/forms/visible-if-formula";
import { summarizeVisibility } from "./visibilitySummary";

const fieldsById: Record<string, AnyField> = {
  q: { id: "q", type: "input", kind: "text", label: "Question" },
  m: {
    id: "m",
    type: "input",
    kind: "multiselect",
    label: "Many",
    options: [],
  },
};

describe("summarizeVisibility", () => {
  it("names options and other forms' questions by label", () => {
    const pet: AnyField = {
      id: "pet",
      type: "input",
      kind: "radio",
      label: "Pet",
      options: [
        { label: "A cat", value: "cat" },
        { label: " ", value: "dog" },
      ],
    };
    const theirPet: AnyField = { ...pet, label: "Their pet" };
    const summary = summarizeVisibility(
      {
        conditions: {
          c1: { kind: "equals", when: "pet", equals: "cat" },
          c2: { kind: "includesOption", when: "pet", includesOption: "dog" },
          c3: {
            kind: "hasValue",
            when: "pet",
            hasValue: true,
            sourceFormId: 7,
          },
        },
        formula: {
          op: "AND",
          left: "c1",
          right: { op: "AND", left: "c2", right: "c3" },
        },
      },
      (id, sourceFormId) =>
        id !== "pet" ? undefined : sourceFormId === 7 ? theirPet : pet,
    );
    expect(summary).toBe(
      'Pet is "A cat" AND Pet includes "dog" AND Their pet (form 7) is answered',
    );
  });

  it("replaces each condition name in the formula with what it checks", () => {
    const summary = summarizeVisibility(
      {
        conditions: {
          condition1: { kind: "equals", when: "q", equals: "yes" },
          condition10: {
            kind: "selectedCount",
            when: "m",
            comparison: SelectedCountComparison.AtLeast,
            count: 2,
          },
        },
        formula: {
          op: "OR",
          left: "condition1",
          right: { op: "NOT", operand: "condition10" },
        },
      },
      (id) => fieldsById[id],
    );
    expect(summary).toBe('Question is "yes" OR (NOT Many selections ≥ 2)');
  });

  it("describes conditions whatever they are named", () => {
    const city: Condition = { kind: "userHasCity", userHasCity: true };
    const summary = summarizeVisibility(
      {
        conditions: { AND: city, "-x": { ...city, userHasCity: false } },
        formula: {
          op: "AND",
          left: "AND",
          right: { op: "NOT", operand: "-x" },
        },
      },
      () => undefined,
    );
    expect(summary).toBe("user has city AND (NOT user has no city)");
  });

  it("leaves a name with no condition as written", () => {
    expect(
      summarizeVisibility(
        { conditions: {}, formula: "missing" },
        () => undefined,
      ),
    ).toBe("missing");
  });

  it.each<[Condition, string]>([
    [{ kind: "equals", when: "q", equals: "yes" }, 'Question is "yes"'],
    [
      { kind: "includesOption", when: "q", includesOption: "o1" },
      'Question includes "o1"',
    ],
    [
      { kind: "anySelected", when: "q", anySelected: false },
      "Question has no selection",
    ],
    [
      {
        kind: "selectedCount",
        when: "q",
        comparison: SelectedCountComparison.LessThan,
        count: 3,
      },
      "Question selections < 3",
    ],
    [
      { kind: "hasValue", when: "q", hasValue: false },
      "Question is unanswered",
    ],
    [
      { kind: "hasValue", when: "remote", hasValue: true, sourceFormId: 7 },
      "remote (form 7) is answered",
    ],
    [
      { kind: "validator", validatorId: 4, resultEquals: false },
      "validator 4 is false",
    ],
    [
      { kind: "deviceType", deviceType: ["mobile", "tablet"] },
      "device is mobile or tablet",
    ],
    [
      {
        kind: "outputBlockVisible",
        outputBlockVisible: "b1",
        isVisible: false,
      },
      "block b1 is hidden",
    ],
    [{ kind: "userHasCity", userHasCity: false }, "user has no city"],
    [
      {
        kind: "userPropertyHasValue",
        property: UserValueProperty.City,
        hasValue: true,
      },
      "user city is set",
    ],
    [
      {
        kind: "firstContractSigned",
        comparison: "onOrAfter",
        date: "2026-01-01T00:00:00.000Z",
      },
      "first contract signed on or after 2026-01-01T00:00:00.000Z",
    ],
    [{ kind: "completedActionCount", atLeast: 2 }, "completed actions ≥ 2"],
  ])("describes %j", (condition, expected) => {
    expect(
      summarizeVisibility(
        { conditions: { c: condition }, formula: "c" },
        (id, sourceFormId) =>
          sourceFormId === null ? fieldsById[id] : undefined,
      ),
    ).toBe(expected);
  });
});
