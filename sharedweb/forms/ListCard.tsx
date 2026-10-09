import type { ListField } from "@alliance/common/forms/form-schema";
import { CardStyle } from "@alliance/shared/styles/card";
import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import Card from "../ui/Card";
import NewButton, { ButtonColor, ButtonSize } from "../ui/NewButton";

/** One card of a list field: its sub-fields, beside `remove`. */
export function ListCard({
  children,
  remove,
}: {
  children: ReactNode;
  remove: ReactNode;
}) {
  return (
    <Card style={CardStyle.WhiteBorder} className="gap-4">
      <div className="flex flex-row gap-x-4 justify-between">
        <div className="w-full space-y-6">{children}</div>
        {remove}
      </div>
    </Card>
  );
}

/** Under a sub-field that output views leave out. */
export function ListHiddenNote() {
  return (
    <p className="text-xs text-gray-500">
      This will not be shown to other members.
    </p>
  );
}

export function ListRemoveButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <NewButton
      onClick={onClick}
      disabled={disabled}
      color={ButtonColor.Red}
      size={ButtonSize.Small}
      iconLeft={X}
    />
  );
}

export function ListAddButton({
  listField,
  onClick,
}: {
  listField: ListField;
  onClick: () => void;
}) {
  return (
    <NewButton
      type="button"
      onClick={onClick}
      color={ButtonColor.LightHover}
      iconLeft={Plus}
      centerIcon
      className="w-full"
    >
      {listField.addButtonLabel?.trim() ?? "Add item"}
    </NewButton>
  );
}
