import {
  anyFieldSchema,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import { renderCell } from "./cells";
import { compareAnswers } from "./sorting";

const parseField = (input: unknown): AnyField => {
  const parsed = anyFieldSchema.safeParse(input);
  if (!parsed.success) throw new Error("test fixture is not a field");
  return parsed.data;
};

const cell = (params: { field: AnyField; value: unknown }) => ({
  value: params.value,
  text: renderCell(params).text,
});

const sortValues = (params: { field: AnyField; values: unknown[] }) =>
  [...params.values]
    .sort((a, b) =>
      compareAnswers({
        field: params.field,
        a: cell({ field: params.field, value: a }),
        b: cell({ field: params.field, value: b }),
      }),
    )
    .map((value) => renderCell({ field: params.field, value }).text);

const NUMBER = parseField({
  id: "n",
  type: "input",
  kind: "number",
  label: "How many?",
});
const RANGE = parseField({
  id: "r",
  type: "input",
  kind: "range",
  label: "How sure?",
});
const DATE = parseField({
  id: "d",
  type: "input",
  kind: "date",
  label: "When?",
});
const TEXT = parseField({
  id: "t",
  type: "input",
  kind: "textarea",
  label: "Notes",
});
const SELECT = parseField({
  id: "s",
  type: "input",
  kind: "select",
  label: "Pick one",
  options: [
    { value: "z-1", label: "Apricots" },
    { value: "a-2", label: "Bananas" },
    { value: "m-3", label: "Cherries" },
  ],
});
const CHECKBOX = parseField({
  id: "c",
  type: "input",
  kind: "checkbox",
  label: "Agreed?",
});

describe("compareAnswers", () => {
  it("sorts numbers numerically, not as strings", () => {
    expect(sortValues({ field: NUMBER, values: [9, 100, 10, 2] })).toEqual([
      "2",
      "9",
      "10",
      "100",
    ]);
  });

  it("sorts a range numerically even when stored as text", () => {
    expect(sortValues({ field: RANGE, values: ["10", "2", "7"] })).toEqual([
      "2",
      "7",
      "10",
    ]);
  });

  it("sorts dates chronologically", () => {
    expect(
      sortValues({
        field: DATE,
        values: ["2026-01-09", "2025-12-31", "2026-01-10"],
      }),
    ).toEqual(["2025-12-31", "2026-01-09", "2026-01-10"]);
  });

  it("sorts an option field by its labels, not its stored values", () => {
    expect(
      sortValues({ field: SELECT, values: ["m-3", "z-1", "a-2"] }),
    ).toEqual(["Apricots", "Bananas", "Cherries"]);
  });

  it("sorts text lexically and case-insensitively", () => {
    expect(
      sortValues({ field: TEXT, values: ["banana", "Apple", "cherry"] }),
    ).toEqual(["Apple", "banana", "cherry"]);
  });

  it("sorts a checkbox unchecked before checked", () => {
    expect(sortValues({ field: CHECKBOX, values: [true, false] })).toEqual([
      "No",
      "Yes",
    ]);
  });

  it("puts unanswered cells last", () => {
    expect(
      sortValues({ field: NUMBER, values: [3, null, 1, undefined, ""] }),
    ).toEqual(["1", "3", "", "", ""]);
  });

  it("holds a pair equal when both cells are unanswered", () => {
    expect(
      compareAnswers({
        field: TEXT,
        a: { value: null, text: "" },
        b: { value: "", text: "" },
      }),
    ).toBe(0);
  });
});

describe("renderCell", () => {
  it("leaves an unanswered question empty", () => {
    expect(renderCell({ field: TEXT, value: undefined }).text).toBe("");
  });

  it("numbers a ranking in the order it was ranked", () => {
    const ranking = parseField({
      id: "rank",
      type: "input",
      kind: "ranking",
      label: "Order these",
      options: [
        { value: "a", label: "Apricots" },
        { value: "b", label: "Bananas" },
      ],
    });

    expect(renderCell({ field: ranking, value: ["b", "a"] }).text).toBe(
      "1. Bananas, 2. Apricots",
    );
  });

  it("summarises a list as its first entry plus a count", () => {
    const list = parseField({
      id: "people",
      type: "input",
      kind: "list",
      label: "Who else?",
      fields: [{ id: "who", type: "input", kind: "text", label: "Name" }],
    });

    const content = renderCell({
      field: list,
      value: [{ who: "Ada" }, { who: "Bo" }, { who: "Cy" }],
    });

    expect(content.summary).toBe("Ada (+2 others)");
    expect(content.text).toBe("1. Ada\n2. Bo\n3. Cy");
  });

  it("shows a city by name", () => {
    const city = parseField({
      id: "city",
      type: "input",
      kind: "city",
      label: "Where?",
    });

    expect(
      renderCell({
        field: city,
        value: { id: 5, name: "Lisbon", countryName: "Portugal" },
      }).text,
    ).toBe("Lisbon");
  });
});
