import type {
  DateField,
  EmailField,
  FileField,
  TimeField,
  TimezoneField,
} from "@alliance/common/forms/form-schema";
import type { ReactNode } from "react";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

type LabelOnlyField =
  | DateField
  | EmailField
  | FileField
  | TimeField
  | TimezoneField;

type EditableLabelOnlyFieldProps = Omit<
  BaseFieldProps<LabelOnlyField>,
  "onUpdate"
> & {
  onUpdate: (
    updates: Partial<Pick<LabelOnlyField, "label" | "required">>,
  ) => void;
  children?: ReactNode;
};

export function EditableLabelOnlyField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
  children,
}: EditableLabelOnlyFieldProps) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
      />

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />
      {children}
    </FieldWrapper>
  );
}
