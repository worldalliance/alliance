import type { AnyField, FieldKind } from "@alliance/common/forms/form-schema";
import { EditableContractField } from "./EditableContractField";
import { EditableCustomComponentField } from "./EditableCustomComponentField";
import { EditableImageField } from "./EditableImageField";
import { EditableListField } from "./EditableListField";
import { EditableRankingField } from "./EditableRankingField";
import { EditableTimePickerField } from "./EditableTimePickerField";
import { EditableToggleField } from "./EditableToggleField";
import { SUB_FIELD_EDITORS } from "./subFieldEditors";
import type { BaseFieldProps, FieldEditor, FieldOfKind } from "./types";

const FIELD_EDITORS: { [K in FieldKind]: FieldEditor<K> } = {
  ...SUB_FIELD_EDITORS,
  ranking: EditableRankingField,
  contract: EditableContractField,
  list: EditableListField,
  custom: EditableCustomComponentField,
  image: EditableImageField,
  toggle: EditableToggleField,
  timePicker: EditableTimePickerField,
};

function renderEditorOfKind<K extends FieldKind>(
  kind: K,
  props: BaseFieldProps<FieldOfKind[K]>,
) {
  const Editor: FieldEditor<K> | undefined = FIELD_EDITORS[kind];
  if (!Editor) throw new Error(`no editor for field kind ${kind}`);
  return <Editor {...props} />;
}

export function renderFieldEditor(props: BaseFieldProps<AnyField>) {
  return renderEditorOfKind(props.field.kind, props);
}
