import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import type {
  FormSchema,
  ListField,
  TextField,
} from "@alliance/common/forms/form-schema";
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PREVIOUS_ANSWER_EMPTY_TEXT,
  PreviousAnswerShape,
  previousAnswerEmptyText,
  resolvePreviousAnswer,
} from "./previousAnswers";

const block = (
  overrides: Partial<PreviousAnswerBlock> = {},
): PreviousAnswerBlock => ({
  type: "display",
  kind: "previousAnswer",
  sourceFormId: 1,
  sourceFieldId: "name",
  showLabel: true,
  ...overrides,
});

const nameField: TextField = {
  id: "name",
  type: "input",
  kind: "text",
  label: "Name",
};

const petsField: ListField = {
  id: "pets",
  type: "input",
  kind: "list",
  label: "Pets",
  fields: [{ ...nameField, id: "petName" }],
};

const schema: FormSchema = {
  pages: [{ id: "p1", fields: [nameField, petsField] }],
  outputViews: [],
};

describe("previousAnswerEmptyText", () => {
  test("uses the block's own text", () => {
    expect(previousAnswerEmptyText(block({ emptyText: "Nothing yet" }))).toBe(
      "Nothing yet",
    );
  });

  test.each([undefined, ""])("falls back to the default for %p", (text) => {
    expect(previousAnswerEmptyText(block({ emptyText: text }))).toBe(
      DEFAULT_PREVIOUS_ANSWER_EMPTY_TEXT,
    );
  });
});

describe("resolvePreviousAnswer", () => {
  test("returns the source field and its answer", () => {
    expect(
      resolvePreviousAnswer({
        block: block(),
        schema,
        answers: { name: "Ada" },
      }),
    ).toEqual({
      shape: PreviousAnswerShape.Single,
      field: nameField,
      value: "Ada",
    });
  });

  test("returns a non-empty list answer", () => {
    const rows = [{ petName: "Rex" }];
    expect(
      resolvePreviousAnswer({
        block: block({ sourceFieldId: "pets" }),
        schema,
        answers: { pets: rows },
      }),
    ).toEqual({ shape: PreviousAnswerShape.List, field: petsField, rows });
  });

  test("is null without a schema", () => {
    expect(
      resolvePreviousAnswer({
        block: block(),
        schema: undefined,
        answers: { name: "Ada" },
      }),
    ).toBeNull();
  });

  test("is null without answers", () => {
    expect(
      resolvePreviousAnswer({ block: block(), schema, answers: undefined }),
    ).toBeNull();
  });

  test("is null for a field missing from the schema", () => {
    expect(
      resolvePreviousAnswer({
        block: block({ sourceFieldId: "other" }),
        schema,
        answers: { other: "x" },
      }),
    ).toBeNull();
  });

  test.each([undefined, null, ""])(
    "is null for an empty answer %p",
    (value) => {
      expect(
        resolvePreviousAnswer({
          block: block(),
          schema,
          answers: { name: value },
        }),
      ).toBeNull();
    },
  );

  test.each([[[]], ["Rex"], [["Rex"]]])(
    "is null for a list answer without rows %p",
    (pets) => {
      expect(
        resolvePreviousAnswer({
          block: block({ sourceFieldId: "pets" }),
          schema,
          answers: { pets },
        }),
      ).toBeNull();
    },
  );
});
