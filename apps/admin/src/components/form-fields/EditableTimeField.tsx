import type { TimeField } from "@alliance/common/forms/form-schema";
import { EditableLabelOnlyField } from "./EditableLabelOnlyField";
import type { BaseFieldProps } from "./types";

export function EditableTimeField(props: BaseFieldProps<TimeField>) {
  return (
    <EditableLabelOnlyField {...props}>
      <p className="text-xs text-gray-500">
        Collects a time in 12-hour format (e.g. 7:30 PM).
      </p>
    </EditableLabelOnlyField>
  );
}
