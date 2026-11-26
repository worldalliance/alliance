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
import { EmptyState } from "../../ui/EmptyState";

const buildPreviewAnswers = (fields: AnyField[]): Record<string, FormValue> => {
  const answers: Record<string, FormValue> = {};
  fields.forEach((field) => {
    switch (field.kind) {
      case "checkbox":
      case "toggle":
        answers[field.id] = true;
        break;
      case "radio":
      case "conversation":
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
      case "timePicker":
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
      case "image":
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

  return view.blocks.length > 0 ? (
    <div className="member-surface mx-auto w-full max-w-3xl rounded-card border border-line bg-surface p-card">
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
    <EmptyState
      title="Nothing to preview"
      description="Add a block to this view to see it here with sample answers."
    />
  );
}
