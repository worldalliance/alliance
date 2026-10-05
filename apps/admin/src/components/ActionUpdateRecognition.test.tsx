import type { AnyField } from "@alliance/common/forms/form-schema";
import { FormFieldsStatus } from "@alliance/shared/lib/useFormSchema";
import {
  actionFormFields,
  actionFormNotice,
  ActionFormStatus,
  combinedFormFieldsStatus,
} from "./ActionUpdateRecognition";

const loaded = (
  taskFormId: number | undefined,
  variantFormIds: readonly number[] = [],
) => ({ status: ActionFormStatus.Loaded, taskFormId, variantFormIds }) as const;

const numberField = (id: string, label: string): AnyField => ({
  id,
  type: "input",
  kind: "number",
  label,
});

describe("actionFormNotice", () => {
  it("says the action is loading rather than that it has no form", () => {
    expect(
      actionFormNotice(
        { status: ActionFormStatus.Loading },
        FormFieldsStatus.Pending,
      ),
    ).toBe("Loading the action's form…");
  });

  it("says the action failed to load", () => {
    expect(
      actionFormNotice(
        { status: ActionFormStatus.LoadFailed },
        FormFieldsStatus.Pending,
      ),
    ).toMatch(/couldn't be loaded/);
  });

  it("says a loaded action has no form", () => {
    expect(
      actionFormNotice(loaded(undefined), FormFieldsStatus.Pending),
    ).toMatch(/no form/);
  });

  it("reads the API's null taskFormId as no form", () => {
    const { taskFormId } = JSON.parse('{"taskFormId":null}');
    expect(
      actionFormNotice(loaded(taskFormId), FormFieldsStatus.Pending),
    ).toMatch(/no form/);
  });

  it("reports the form's own load, and nothing once it's ready", () => {
    expect(actionFormNotice(loaded(4), FormFieldsStatus.Pending)).toBe(
      "Loading the action's form…",
    );
    expect(actionFormNotice(loaded(4), FormFieldsStatus.LoadFailed)).toBe(
      "The action's form couldn't be loaded.",
    );
    expect(actionFormNotice(loaded(4), FormFieldsStatus.Ready)).toBeNull();
  });
});

describe("actionFormNotice with variants", () => {
  it("shows no notice for an action whose only forms are variants", () => {
    expect(
      actionFormNotice(loaded(undefined, [5]), FormFieldsStatus.Ready),
    ).toBeNull();
  });

  it("names a variant's failed load as one of the action's forms", () => {
    expect(
      actionFormNotice(loaded(4, [5]), FormFieldsStatus.LoadFailed),
    ).toMatch(/One of the action's forms/);
  });
});

describe("actionFormFields", () => {
  it("offers a variant's own questions alongside the form's, once per field id", () => {
    const fields = actionFormFields([4, 5], {
      4: [numberField("letters", "Letters")],
      5: [
        numberField("letters", "Letters sent"),
        numberField("calls", "Calls"),
      ],
    });
    expect(fields.map((field) => [field.id, field.label])).toEqual([
      ["letters", "Letters"],
      ["calls", "Calls"],
    ]);
  });

  it("offers nothing from a form still loading", () => {
    expect(actionFormFields([4], {})).toEqual([]);
  });
});

describe("combinedFormFieldsStatus", () => {
  it("reports a failure over a pending load, and a pending load over ready", () => {
    expect(
      combinedFormFieldsStatus([
        FormFieldsStatus.Ready,
        FormFieldsStatus.Pending,
        FormFieldsStatus.LoadFailed,
      ]),
    ).toBe(FormFieldsStatus.LoadFailed);
    expect(
      combinedFormFieldsStatus([
        FormFieldsStatus.Ready,
        FormFieldsStatus.Pending,
      ]),
    ).toBe(FormFieldsStatus.Pending);
    expect(combinedFormFieldsStatus([FormFieldsStatus.Ready])).toBe(
      FormFieldsStatus.Ready,
    );
  });
});
