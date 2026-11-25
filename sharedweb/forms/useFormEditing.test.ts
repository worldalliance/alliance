import type { FormSchema } from "@alliance/common/forms/form-schema";
import { validateFieldValue } from "@alliance/shared/forms/fieldValidation";
import { useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import { useFieldErrors } from "@alliance/shared/forms/useFormValidation";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { act, renderHook } from "@testing-library/react";
import { useFormDraftState } from "./useFormDraftState";
import { useFormEditing } from "./useFormEditing";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "name",
          type: "input",
          kind: "text",
          label: "Name",
          required: true,
        },
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
        { id: "text", type: "input", kind: "toggle", label: "Text" },
        {
          id: "email",
          type: "input",
          kind: "toggle",
          label: "Email",
          atLeastOneOnWith: "text",
        },
      ],
    },
  ],
  outputViews: [],
};

const renderEditing = ({
  readOnly = false,
  hidden = [],
}: { readOnly?: boolean; hidden?: string[] } = {}) => {
  const onFormStarted = jest.fn();
  const hook = renderHook(() => {
    const maps = useFormSchemaMaps({
      schema,
      userDefaultPublic: true,
      timeZone: "UTC",
      profilePhoneNumber: null,
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
      validateFieldValue: (field, value, data) =>
        validateFieldValue(field, value, data ?? {}, {
          deviceType: "desktop",
        }),
      isElementCurrentlyVisible: (element) =>
        !(element.id && hidden.includes(element.id)),
      applyFieldErrorUpdates,
    });
    return { draft, editing, fieldErrors, applyFieldErrorUpdates };
  }, queryWrapper());
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
  expect(hook.result.current.fieldErrors.name).toBe("This field is required.");

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

it("clears a paired toggle's error once its partner's answer satisfies it", () => {
  const { hook } = renderEditing();
  const required = "This field is required.";

  act(() => hook.result.current.applyFieldErrorUpdates({ email: required }));
  act(() => hook.result.current.editing.updateField("text", true));

  expect(hook.result.current.fieldErrors.email).toBeUndefined();
});

it("keeps a toggle on when its partner is hidden", () => {
  const { hook } = renderEditing({ hidden: ["text"] });

  act(() => hook.result.current.editing.updateField("email", false));

  expect(hook.result.current.draft.formData.email).toBe(true);
});
