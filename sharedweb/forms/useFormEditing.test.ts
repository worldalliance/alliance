import type { FormSchema } from "@alliance/common/forms/form-schema";
import { useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import { useFieldErrors } from "@alliance/shared/forms/useFormValidation";
import { act, renderHook } from "@testing-library/react";
import { useFormDraftState } from "./useFormDraftState";
import { useFormEditing } from "./useFormEditing";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        {
          id: "order",
          type: "input",
          kind: "ranking",
          label: "Order",
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

const renderEditing = ({ readOnly = false } = {}) => {
  const onFormStarted = jest.fn();
  const hook = renderHook(() => {
    const maps = useFormSchemaMaps({
      schema,
      userDefaultPublic: true,
      timeZone: "UTC",
    });
    const draft = useFormDraftState({
      ...maps,
      formId: 1,
      actionId: 1,
      formSnapshotId: 1,
      readOnly,
      userDefaultPublic: true,
    });
    const { fieldErrors, applyFieldErrorUpdates } = useFieldErrors();
    const editing = useFormEditing({
      readOnly,
      edited: draft.edited,
      markEdited: draft.markEdited,
      onFormStarted,
      setFormData: draft.setFormData,
      fieldLookup: maps.fieldLookup,
      validateFieldValue: (_field, value) =>
        !value || (Array.isArray(value) && value.length === 0)
          ? "Required"
          : null,
      applyFieldErrorUpdates,
    });
    return { draft, editing, fieldErrors };
  });
  return { hook, onFormStarted };
};

it("reports the form started once, on the first edit", () => {
  const { hook, onFormStarted } = renderEditing();

  act(() => hook.result.current.editing.updateField("name", "A"));
  act(() => hook.result.current.editing.updateField("name", "Ab"));

  expect(onFormStarted).toHaveBeenCalledTimes(1);
  expect(hook.result.current.draft.edited).toBe(true);
  expect(hook.result.current.draft.formData.name).toBe("Ab");
});

it("validates the field as it changes", () => {
  const { hook } = renderEditing();

  act(() => hook.result.current.editing.updateField("name", ""));
  expect(hook.result.current.fieldErrors.name).toBe("Required");

  act(() => hook.result.current.editing.updateField("name", "A"));
  expect(hook.result.current.fieldErrors.name).toBeUndefined();
});

it("ignores edits to a completed form", () => {
  const { hook, onFormStarted } = renderEditing({ readOnly: true });

  act(() => hook.result.current.editing.updateField("name", "A"));

  expect(onFormStarted).not.toHaveBeenCalled();
  expect(hook.result.current.draft.edited).toBe(false);
  expect(hook.result.current.draft.formData.name).toBeUndefined();
});

it("leaves a partial ranking unflagged while the member places items", () => {
  const { hook } = renderEditing();

  act(() => hook.result.current.editing.updateField("order", []));

  expect(hook.result.current.fieldErrors.order).toBeUndefined();
});
