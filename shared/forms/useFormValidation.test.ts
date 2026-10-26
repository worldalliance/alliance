import {
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { act, renderHook } from "@testing-library/react";
import {
  gatedOnYes,
  listField,
  lookupFor,
  NO_AGGREGATES_READY,
  NO_SOURCES_READY,
  schemaWith,
  SETTLED_INPUTS,
  textField,
  twoPageSchema,
} from "../lib/testing/formVisibility";
import { useFormVisibility, type FormVisibility } from "../useFormRenderer";
import { useFieldErrors, useFormValidation } from "./useFormValidation";

describe("useFieldErrors", () => {
  it("sets and clears messages, treating blank as cleared", () => {
    const { result } = renderHook(() => useFieldErrors());

    act(() => result.current.applyFieldErrorUpdates({ a: "required" }));
    expect(result.current.fieldErrors).toEqual({ a: "required" });

    act(() => result.current.applyFieldErrorUpdates({ a: "   " }));
    expect(result.current.fieldErrors).toEqual({});
  });

  it("clears list sub-field errors by their parent prefix", () => {
    const { result } = renderHook(() => useFieldErrors());

    act(() =>
      result.current.applyFieldErrorUpdates({
        "list:0:street": "required",
        other: "required",
      }),
    );
    expect(Object.keys(result.current.fieldErrors).sort()).toEqual([
      "list:0:street",
      "other",
    ]);

    act(() => result.current.applyFieldErrorUpdates({}, ["list"]));
    expect(result.current.fieldErrors).toEqual({ other: "required" });
  });

  it("drops every message at once", () => {
    const { result } = renderHook(() => useFieldErrors());

    act(() => result.current.applyFieldErrorUpdates({ a: "x", b: "y" }));
    act(() => result.current.clearFieldErrors());
    expect(result.current.fieldErrors).toEqual({});
  });
});

function renderValidation(args: {
  schema: FormSchema;
  formData: Record<string, FormValue>;
}) {
  return renderHook(
    (formData: Record<string, FormValue>) => {
      const { applyFieldErrorUpdates, fieldErrors } = useFieldErrors();
      const visibility: FormVisibility = useFormVisibility({
        schema: args.schema,
        formData,
        readOnly: false,
        currentPageIndex: 0,
        setCurrentPageIndex: () => {},
        setFormData: () => {},
        effectiveDeviceType: "desktop",
        visibilityValidatorResults: {},
        fieldLookup: lookupFor(args.schema),
        previousAnswerData: undefined,
        sourceHistories: NO_SOURCES_READY,
        variableAggregates: NO_AGGREGATES_READY,
        randomizationKey: "form:1:user:1",
        userHasCity: false,
        firstContractSignedAt: null,
        completedActionCount: 0,
        visibilityInputs: SETTLED_INPUTS,
      });
      const validation = useFormValidation({
        schema: args.schema,
        readOnly: false,
        effectiveFormData: visibility.effectiveFormData,
        visibilityExtras: visibility.visibilityExtras,
        visiblePageIndices: visibility.visiblePageIndices,
        isElementCurrentlyVisible: visibility.isElementCurrentlyVisible,
        validateFieldValue: visibility.validateFieldValue,
        applyFieldErrorUpdates,
      });
      return { ...validation, fieldErrors, applyFieldErrorUpdates };
    },
    { initialProps: args.formData },
  );
}

/** `act` around a validation run, so the error state it sets is flushed. */
async function validate<T>(run: () => Promise<T>): Promise<T> {
  let pending!: Promise<T>;
  await act(async () => {
    pending = run();
    await pending;
  });
  return pending;
}

describe("useFormValidation", () => {
  it("passes a hidden page and clears the errors its fields left", async () => {
    const { result } = renderValidation({
      schema: twoPageSchema,
      formData: { gate: "no" },
    });

    act(() => result.current.applyFieldErrorUpdates({ detail: "stale" }));
    expect(result.current.fieldErrors.detail).toBe("stale");

    const page = await validate(() => result.current.validatePage(1, false));
    expect(page.isValid).toBe(true);
    expect(result.current.fieldErrors.detail).toBeUndefined();
  });

  it("blocks the page on a required field the user can see", async () => {
    const { result } = renderValidation({
      schema: twoPageSchema,
      formData: { gate: "yes" },
    });

    const page = await validate(() => result.current.validatePage(1, false));
    expect(page.isValid).toBe(false);
    expect(page.firstInvalidFieldId).toBe("detail");
  });

  // The error key is `parentId:cardIndex:subId`, which is no field's id, so the
  // caller is pointed at the list that owns the card instead.
  it("blocks the page on an invalid list sub-field", async () => {
    const schema = schemaWith([
      listField("addresses", [{ ...textField("street"), required: true }]),
    ]);
    const { result } = renderValidation({
      schema,
      formData: { addresses: [{ street: "" }] },
    });

    const page = await validate(() => result.current.validatePage(0, false));
    expect(page.isValid).toBe(false);
    expect(page.firstInvalidFieldId).toBe("addresses");
    expect(result.current.fieldErrors["addresses:0:street"]).toBeTruthy();
  });

  it("clears a card's errors once the list itself is hidden", async () => {
    const schema: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            textField("gate"),
            {
              ...listField("addresses", [
                { ...textField("street"), required: true },
              ]),
              visibleIfFormula: gatedOnYes,
            },
          ],
        },
      ],
      outputViews: [],
    };
    const { result, rerender } = renderValidation({
      schema,
      formData: { gate: "yes", addresses: [{ street: "" }] },
    });

    await validate(() => result.current.validatePage(0, false));
    expect(result.current.fieldErrors["addresses:0:street"]).toBeTruthy();

    rerender({ gate: "no", addresses: [{ street: "" }] });
    const page = await validate(() => result.current.validatePage(0, false));

    expect(page.isValid).toBe(true);
    expect(result.current.fieldErrors).toEqual({});
  });

  it("reports the first invalid page across the whole form", async () => {
    const schema: FormSchema = {
      pages: [
        { id: "p1", fields: [textField("free")] },
        { id: "p2", fields: [{ ...textField("needed"), required: true }] },
      ],
      outputViews: [],
    };
    const { result } = renderValidation({ schema, formData: {} });

    const all = await validate(() => result.current.validateAllPages());
    expect(all.isValid).toBe(false);
    expect(all.firstInvalidPageIndex).toBe(1);
    expect(all.firstInvalidFieldId).toBe("needed");
  });
});
