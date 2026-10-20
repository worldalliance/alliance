import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  FormSchema,
  FormValue,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import { getRankingSlotCount } from "@alliance/common/forms/ranking";
import OutputRenderer from "@alliance/sharedweb/forms/OutputRenderer";
import { useMemo } from "react";

const buildPreviewAnswers = (fields: AnyField[]): Record<string, FormValue> => {
  const answers: Record<string, FormValue> = {};
  fields.forEach((field) => {
    switch (field.kind) {
      case "checkbox":
        answers[field.id] = true;
        break;
      case "radio":
      case "select":
        answers[field.id] = field.options?.[0]?.value ?? field.label;
        break;
      case "multiselect":
        answers[field.id] = field.options
          ?.slice(0, 2)
          .map((option) => option.value) ?? [field.label];
        break;
      case "ranking":
        answers[field.id] = field.options
          .slice(0, getRankingSlotCount(field))
          .map((option) => option.value);
        break;
      case "number":
        answers[field.id] = 42;
        break;
      case "date":
        answers[field.id] = "2024-01-01";
        break;
      case "time":
        answers[field.id] = "09:00";
        break;
      case "timezone":
        answers[field.id] = "America/Los_Angeles";
        break;
      case "city":
        answers[field.id] = {
          id: 1,
          name: "San Francisco",
          admin1: "California",
          countryCode: "US",
          countryName: "United States",
        };
        break;
      case "file":
        answers[field.id] = "uploaded/file.pdf";
        break;
      case "email":
        answers[field.id] = "user@example.com";
        break;
      case "phone":
        answers[field.id] = "+14155552671";
        break;
      case "list":
        answers[field.id] = [buildPreviewAnswers(field.fields)];
        break;
      default:
        answers[field.id] = `${elementInternalDescriptor(field)} response`;
        break;
    }
  });
  return answers;
};

interface OutputPreviewProps {
  schema: FormSchema;
  view: OutputViewSchema;
  outputFields: AnyField[];
}

export function OutputPreview({
  schema,
  view,
  outputFields,
}: OutputPreviewProps) {
  const previewAnswers = useMemo(
    () => buildPreviewAnswers(outputFields),
    [outputFields],
  );

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Output preview</h3>
      </div>
      {view.blocks.length > 0 ? (
        <div className="border-t border-gray-200 pt-2">
          <OutputRenderer
            submission={{
              id: 0,
              formId: 0,
              deviceType: null,
              answers: previewAnswers,
              visibilityValidatorResults: {},
              publicAnswers: Object.fromEntries(
                outputFields.map((field) => [field.id, true]),
              ),
              schemaSnapshot: schema as unknown as Record<string, unknown>,
            }}
            viewId={view.id}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Add at least one block to see a preview.
        </p>
      )}
    </div>
  );
}
