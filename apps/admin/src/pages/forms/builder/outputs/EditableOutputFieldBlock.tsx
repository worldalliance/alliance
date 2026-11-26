import {
  elementInternalDescriptor,
  fieldPickerLabel,
} from "@alliance/common/forms/element-descriptors";
import {
  type AnyField,
  type OutputFieldBlock,
} from "@alliance/common/forms/form-schema";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { ReadOnlyId } from "../kit/ReadOnlyId";
import { cn } from "../../../../ui/cn";
import { Select } from "../../../../ui/Select";
import { controlClass } from "../../../../ui/styles";
import { CheckboxField, Field } from "../../../../ui/templates/Form";
import { SectionPanels } from "../inspector/sidebarSections";
import type { OutputBlockOption } from "../conditions/ContextRules";
import { ElementConditions } from "../conditions/VisibilityConditions";
import { VariableTextField } from "../questions/VariableTextField";

const FORMATS: {
  value: NonNullable<OutputFieldBlock["format"]>;
  label: string;
}[] = [
  { value: "field", label: "As form field" },
  { value: "textonly", label: "Content only" },
];

/**
 * The inspector's panels for an output field block, inside `SidebarSections`:
 * which question it shows and how, and the output-block rules.
 */
export function EditableOutputFieldBlock({
  block,
  onUpdate,
  availableFields,
  outputBlocks,
}: {
  block: OutputFieldBlock;
  onUpdate: (updates: Partial<OutputFieldBlock>) => void;
  availableFields: AnyField[];
  outputBlocks?: OutputBlockOption[];
}) {
  const selectedField = availableFields.find(
    (field) => field.id === block.fieldId,
  );
  const handleVisibilityChange = (updates: {
    visibleIfFormula?: VisibleIfFormula;
  }) => onUpdate(updates);

  return (
    <SectionPanels
      content={
        <>
          <p className="text-fg-muted">
            {selectedField
              ? elementInternalDescriptor(selectedField)
              : "This output block needs a field selection."}
          </p>
          <Field label="Output field">
            {(control) => (
              <Select
                {...control}
                value={block.fieldId || ""}
                onChange={(event) => onUpdate({ fieldId: event.target.value })}
              >
                {availableFields.length === 0 && (
                  <option value="">No output fields available</option>
                )}
                {availableFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {fieldPickerLabel(field)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <CheckboxField
            label="Show label when rendering"
            checked={block.showLabel ?? true}
            onChange={(event) => onUpdate({ showLabel: event.target.checked })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">
              Label override
              <span className="font-normal text-fg-muted"> (optional)</span>
            </span>
            <VariableTextField
              aria-label="Label override"
              value={block.labelOverride || ""}
              onChange={(labelOverride) =>
                onUpdate({ labelOverride: labelOverride || undefined })
              }
              className={cn(controlClass, "h-control")}
              placeholder="Custom label to display"
            />
          </div>
          <Field label="Display format">
            {(control) => (
              <Select
                {...control}
                value={block.format || "field"}
                onChange={(event) => {
                  const format = FORMATS.find(
                    (candidate) => candidate.value === event.target.value,
                  );
                  if (format) onUpdate({ format: format.value });
                }}
              >
                {FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <ReadOnlyId label="Block ID" value={block.id} />
        </>
      }
      conditions={
        <ElementConditions
          field={block}
          previousFields={availableFields}
          outputBlocks={outputBlocks}
          onChange={handleVisibilityChange}
        />
      }
    />
  );
}
