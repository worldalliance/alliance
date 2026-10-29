import {
  type AnyField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { withResolvedOptions } from "@alliance/common/forms/formula-options";
import { interpolateFieldText } from "@alliance/common/forms/variable-interpolation";
import type React from "react";
import Spinner from "../ui/Spinner";
import FormPage from "./FormPage";
import OutputPublicToggle from "./OutputPublicToggle";
import RenderField from "./RenderField";
import { type WebFormState } from "./useWebFormState";
import { variableInputsGateView } from "./variableInputsGateView";

/** What shows in place of the form while it can't be filled in, or null. */
export function formBlockedView(
  form: WebFormState,
  { showVariableError = false }: { showVariableError?: boolean } = {},
): React.ReactElement | null {
  const gate = variableInputsGateView({
    gate: form.gate,
    readOnly: form.readOnly,
  });
  if (gate !== null) return gate;

  if (form.unknownKind || form.variablesError !== null) {
    return (
      <div
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
        role="alert"
      >
        <p className="font-medium">This form can&apos;t be displayed</p>
        <p className="mt-1 text-sm">
          {showVariableError && form.variablesError !== null
            ? form.variablesError
            : "Refreshing the page may fix the issue."}
        </p>
      </div>
    );
  }

  if (form.visibilityContextLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return null;
}

export function FormElements({
  form,
  elements,
  disableOptionRandomization,
  fieldLabelRightContent,
}: {
  form: WebFormState;
  elements: PageItem[];
  disableOptionRandomization?: boolean;
  fieldLabelRightContent?: Record<string, React.ReactNode>;
}) {
  const { readOnly, fieldErrors } = form;

  const renderField = (field: AnyField) => {
    const isOutputField = Boolean(field.output?.output);
    const defaultSharePublic =
      form.outputFieldDefaultPublic.get(field.id) ?? form.userDefaultPublic;
    const sharePublicly = form.publicAnswers[field.id] ?? defaultSharePublic;
    return (
      <>
        <RenderField
          field={withResolvedOptions(
            interpolateFieldText(field, form.variableValues),
            form.resolvedOptions,
          )}
          value={form.effectiveFormData[field.id]}
          onChange={
            readOnly ? undefined : (val) => form.updateField(field.id, val)
          }
          fileUpload={readOnly ? undefined : form.imageUpload}
          disabled={readOnly}
          error={fieldErrors[field.id]}
          randomizationKey={
            disableOptionRandomization ? undefined : form.randomizationKey
          }
          disableOptionRandomization={disableOptionRandomization}
          user={form.user}
          labelRightAddon={fieldLabelRightContent?.[field.id]}
          fieldContext={form.fieldContext}
          fieldErrors={fieldErrors}
          responseHiddenFromOthers={isOutputField && !sharePublicly}
        />
        <OutputPublicToggle
          field={field}
          sharePublicly={sharePublicly}
          disabled={readOnly}
          onChange={(nextPublic) => form.setPublicAnswer(field.id, nextPublic)}
        />
      </>
    );
  };

  return (
    <FormPage
      elements={elements}
      activeUserKey={form.activeUserKey}
      isElementCurrentlyVisible={form.isElementCurrentlyVisible}
      variableValues={form.variableValues}
      blockProps={{
        previousAnswerData: form.previousAnswerData,
        previousAnswerSchemas: form.previousAnswerSchemas,
        userLocation: form.userLocation.userLocationDisplayValue,
        userLocationLoading: form.userLocation.currentUserLocationLoading,
      }}
      fieldRef={form.fieldRef}
      renderField={renderField}
    />
  );
}
