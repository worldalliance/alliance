import { type PageItem } from "@alliance/common/forms/form-schema";
import { withResolvedOptions } from "@alliance/common/forms/formula-options";
import { interpolateFieldText } from "@alliance/common/forms/variable-interpolation";
import { type ReactElement } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";
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

  if (form.unknownKind || form.variablesError !== null) {
    return (
      <View className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <Text weight={FontWeight.Medium} className="text-amber-800">
          This form can&apos;t be displayed
        </Text>
        <Text className="text-sm text-amber-800 mt-1">
          Restarting the app or downloading the latest version may fix the
          issue.
        </Text>
      </View>
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
}: {
  form: MobileFormState;
  elements: PageItem[];
  disableOptionRandomization?: boolean;
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
      renderField={(field) => (
        <>
          <RenderField
            field={withResolvedOptions(
              interpolateFieldText(field, variableValues),
              form.resolvedOptions,
            )}
            value={form.effectiveFormData[field.id]}
            onChange={(value) => form.handleFieldChange(field.id, value)}
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
