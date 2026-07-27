import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { shareInfoPubliclyToggle } from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import { useEffect, useRef } from "react";
import Card from "../../ui/Card";
import YesNoToggle from "../../ui/YesNoToggle";
import { OptionalLabelPrefix } from "../OptionalLabelPrefix";

const parseBooleanValue = (value: string | null): boolean | null => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
};

const ShareInfoPubliclyToggleComponent = ({
  field,
  value,
  onChange,
  user,
  disabled,
  isOutputView,
  required,
}: CustomComponentProps) => {
  const parsedValue = parseBooleanValue(value);
  const userDefault =
    typeof user?.shareInfoPublicly === "boolean"
      ? user.shareInfoPublicly
      : null;
  const lastSetByDefaultRef = useRef(false);

  const setValueFromDefault = (next: boolean) => {
    if (parsedValue === next) {
      return;
    }
    lastSetByDefaultRef.current = true;
    onChange(next ? "true" : "false");
  };

  useEffect(() => {
    if (disabled) return;
    if (userDefault !== null) {
      if (parsedValue === null) {
        setValueFromDefault(userDefault);
        return;
      }
      if (lastSetByDefaultRef.current && parsedValue !== userDefault) {
        setValueFromDefault(userDefault);
      }
      return;
    }
    if (parsedValue === null) {
      setValueFromDefault(shareInfoPubliclyToggle.fallbackDefault);
    }
  }, [parsedValue, userDefault, disabled]);

  const label =
    typeof field.label === "string" && field.label.trim().length > 0
      ? field.label
      : shareInfoPubliclyToggle.defaultLabel;
  const description =
    typeof field.description === "string" && field.description.trim().length > 0
      ? field.description
      : shareInfoPubliclyToggle.defaultDescription;
  const resolvedValue =
    parsedValue ?? userDefault ?? shareInfoPubliclyToggle.fallbackDefault;
  const isDisabled = Boolean(disabled || user?.anonymous);

  return (
    <Card
      style={CardStyle.White}
      className="flex flex-row gap-x-4 items-center justify-between"
    >
      <div>
        {!(required ?? field.required) && !isOutputView && (
          <OptionalLabelPrefix />
        )}
        <label className="block font-medium mb-1">{label}</label>
        <p className="text-zinc-500">{description}</p>
      </div>
      <YesNoToggle
        value={resolvedValue}
        onChange={(next) => {
          lastSetByDefaultRef.current = false;
          onChange(next ? "true" : "false");
        }}
        disabled={isDisabled}
        ariaLabel={label}
      />
    </Card>
  );
};

export default ShareInfoPubliclyToggleComponent;
