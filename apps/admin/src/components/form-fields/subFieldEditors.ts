import type { ListSubField } from "@alliance/common/forms/form-schema";
import { EditableCheckboxField } from "./EditableCheckboxField";
import { EditableChoiceField } from "./EditableChoiceField";
import { EditableCityField } from "./EditableCityField";
import { EditableLabelOnlyField } from "./EditableLabelOnlyField";
import { EditableNumberField } from "./EditableNumberField";
import { EditablePhoneField } from "./EditablePhoneField";
import { EditableRadioField } from "./EditableRadioField";
import { EditableRangeField } from "./EditableRangeField";
import { EditableTextareaField } from "./EditableTextareaField";
import { EditableTextField } from "./EditableTextField";
import { EditableTimeField } from "./EditableTimeField";
import type { FieldEditor } from "./types";

export const SUB_FIELD_EDITORS: {
  [K in Exclude<ListSubField["kind"], "contract" | "custom">]: FieldEditor<K>;
} = {
  text: EditableTextField,
  textarea: EditableTextareaField,
  email: EditableLabelOnlyField,
  phone: EditablePhoneField,
  number: EditableNumberField,
  range: EditableRangeField,
  checkbox: EditableCheckboxField,
  radio: EditableRadioField,
  // EditableChoiceField writes select- or multiselect-shaped updates by field.kind.
  select: EditableChoiceField as FieldEditor<"select">,
  multiselect: EditableChoiceField as FieldEditor<"multiselect">,
  date: EditableLabelOnlyField,
  time: EditableTimeField,
  timezone: EditableLabelOnlyField,
  city: EditableCityField,
  file: EditableLabelOnlyField,
};
