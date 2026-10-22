import type {
  ListField,
  MultiSelectField,
  RangeField,
} from "@alliance/common/forms/form-schema";
import type { ConditionExtras } from "@alliance/common/forms/visibility";
import { getListSubFieldErrors, validateFieldValue } from "./fieldValidation";

describe("getListSubFieldErrors", () => {
  const extras: ConditionExtras = { deviceType: "desktop" };

  const addresses = (overrides: Partial<ListField> = {}): ListField => ({
    id: "addresses",
    type: "input",
    kind: "list",
    label: "Addresses",
    fields: [
      {
        id: "street",
        type: "input",
        kind: "text",
        label: "Street",
        required: true,
      },
    ],
    ...overrides,
  });

  it("validates the empty cards a list renders before anyone answers it", () => {
    expect(
      getListSubFieldErrors(
        addresses({ defaultNumber: 2 }),
        undefined,
        {},
        extras,
      ),
    ).toEqual({
      "addresses:0:street": "This field is required.",
      "addresses:1:street": "This field is required.",
    });
  });

  it("validates the stored cards once there is an answer", () => {
    expect(
      getListSubFieldErrors(
        addresses({ defaultNumber: 2 }),
        [{ street: "1 Main St" }],
        {},
        extras,
      ),
    ).toEqual({ "addresses:0:street": null });
  });

  it("skips a cell hidden by its own row", () => {
    const list = addresses({
      fields: [
        { id: "hasStreet", type: "input", kind: "text", label: "Has street" },
        {
          id: "street",
          type: "input",
          kind: "text",
          label: "Street",
          required: true,
          visibleIfFormula: {
            conditions: {
              c1: { kind: "equals", when: "hasStreet", equals: "yes" },
            },
            formula: "c1",
          },
        },
      ],
    });
    expect(
      getListSubFieldErrors(
        list,
        [{ hasStreet: "no" }, { hasStreet: "yes" }],
        {},
        extras,
      ),
    ).toEqual({
      "addresses:0:hasStreet": null,
      "addresses:0:street": null,
      "addresses:1:hasStreet": null,
      "addresses:1:street": "This field is required.",
    });
  });
});

describe("validateFieldValue for a range field", () => {
  const extras: ConditionExtras = { deviceType: "desktop" };
  const scale = (required: boolean): RangeField => ({
    id: "scale",
    type: "input",
    kind: "range",
    label: "Scale",
    optionCount: 5,
    required,
  });

  it.each([true, false])("accepts an option when required=%p", (required) => {
    expect(validateFieldValue(scale(required), 3, {}, extras)).toBeNull();
  });

  it.each([true, false])(
    "rejects a value outside the options when required=%p",
    (required) => {
      expect(validateFieldValue(scale(required), 8, {}, extras)).toBe(
        "Please select a value.",
      );
      expect(validateFieldValue(scale(required), 2.5, {}, extras)).toBe(
        "Please select a value.",
      );
    },
  );

  it.each([undefined, ""])("accepts an empty optional answer: %p", (value) => {
    expect(validateFieldValue(scale(false), value, {}, extras)).toBeNull();
  });

  it("requires an answer when required", () => {
    expect(validateFieldValue(scale(true), undefined, {}, extras)).toBe(
      "Please select a value.",
    );
  });
});

describe("validateFieldValue for a multiselect field", () => {
  const extras: ConditionExtras = { deviceType: "desktop" };
  const colors = (maxSelections?: number): MultiSelectField => ({
    id: "colors",
    type: "input",
    kind: "multiselect",
    label: "Colors",
    options: [
      { label: "Red", value: "red" },
      { label: "Blue", value: "blue" },
    ],
    maxSelections,
  });

  it("rejects selections over the cap", () => {
    expect(validateFieldValue(colors(1), ["red", "blue"], {}, extras)).toBe(
      "Select no more than 1 option.",
    );
  });

  it("treats a cap of 0 as no cap", () => {
    expect(
      validateFieldValue(colors(0), ["red", "blue"], {}, extras),
    ).toBeNull();
  });
});
