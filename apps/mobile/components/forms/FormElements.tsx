import { type PageItem } from "@alliance/common/forms/form-schema";
import { withResolvedOptions } from "@alliance/common/forms/formula-options";
import { formUnrenderable } from "@alliance/common/forms/unrenderable";
import { interpolateFieldText } from "@alliance/common/forms/variable-interpolation";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import { UnrenderableSubject } from "@alliance/shared/forms/unrenderable";
import { type ReactElement } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../../lib/style/colors";
import UnrenderableNotice from "../UnrenderableNotice";
import FormPage from "./FormPage";
import OutputPublicToggle from "./OutputPublicToggle";
import { RenderField } from "./RenderField";
import { type MobileFormState } from "./useMobileFormState";
import { variableInputsGateView } from "./variableInputsGateView";

/** What shows in place of the form while it can't be filled in, or null. */
export function formBlockedView(form: MobileFormState): ReactElement | null {
  const gate = variableInputsGateView({
    gate: form.gate,
    readOnly: form.readOnly,
  });
  if (gate !== null) return gate;

  const unrenderable = formUnrenderable(form);
  if (unrenderable !== null) {
    return (
      <UnrenderableNotice
        subject={UnrenderableSubject.Form}
        reason={unrenderable.reason}
        detail={unrenderable.detail}
        content={form.content}
      />
    );
  }

  if (form.visibilityContextLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return null;
}

export function FormElements({
  form,
  elements,
  disableOptionRandomization,
  className,
}: {
  form: MobileFormState;
  elements: PageItem[];
  disableOptionRandomization?: boolean;
  className?: string;
}) {
  const { readOnly, fieldErrors, variableValues } = form;
  return (
    <FormPage
      elements={elements}
      activeUserKey={form.activeUserKey}
      isElementCurrentlyVisible={form.isElementCurrentlyVisible}
      variableValues={variableValues}
      blockProps={{
        previousAnswerData: form.previousAnswerData,
        previousAnswerSchemas: form.previousAnswerSchemas,
        user: form.user,
        userLocation: form.userLocationDisplayValue,
        userLocationLoading: form.currentUserLocationLoading,
      }}
      className={className}
      renderField={(field) => (
        <>
          <RenderField
            field={withResolvedOptions(
              interpolateFieldText(field, variableValues),
              form.resolvedOptions,
            )}
            value={form.effectiveFormData[field.id]}
            onChange={(value) => form.handleFieldChange(field.id, value)}
            {...(field.kind === "conversation" && {
              noteValue: form.effectiveFormData[field.noteId],
              onNoteChange: (value: FormValueUpdater) =>
                form.handleFieldChange(field.noteId, value),
            })}
            fileUpload={readOnly ? undefined : form.imageUpload}
            disabled={readOnly}
            error={fieldErrors[field.id]}
            fieldErrors={fieldErrors}
            randomizationKey={form.randomizationKey}
            disableOptionRandomization={disableOptionRandomization}
            user={form.user}
            fieldContext={form.fieldContext}
          />
          <OutputPublicToggle
            field={field}
            sharePublicly={
              form.publicAnswers[field.id] ??
              form.outputFieldDefaultPublic.get(field.id) ??
              form.userDefaultPublic
            }
            disabled={readOnly}
            onChange={(sharePublicly) =>
              form.handlePublicToggleChange(field.id, sharePublicly)
            }
          />
        </>
      )}
    />
  );
}
