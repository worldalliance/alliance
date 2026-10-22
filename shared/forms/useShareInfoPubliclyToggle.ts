import { useEffect, useRef } from "react";
import type { UserDto } from "../client";
import { shareInfoPubliclyToggle } from "../lib/copy";
import type { CustomComponentProps } from "./customComponents";

const parseBooleanValue = (value: string | null): boolean | null => {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

/** Seeds the answer from the user's saved preference, and follows that preference until the user toggles. */
export function useShareInfoPubliclyToggle({
  field,
  value,
  onChange,
  user,
  disabled,
}: Pick<CustomComponentProps, "field" | "value" | "onChange" | "disabled"> & {
  user?: Pick<UserDto, "shareInfoPublicly" | "anonymous">;
}) {
  const parsedValue = parseBooleanValue(value);
  const userDefault =
    typeof user?.shareInfoPublicly === "boolean"
      ? user.shareInfoPublicly
      : null;
  const lastSetByDefaultRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (disabled) return;
    const setFromDefault = (next: boolean) => {
      if (parsedValue === next) return;
      lastSetByDefaultRef.current = true;
      onChangeRef.current(next ? "true" : "false");
    };
    if (userDefault !== null) {
      if (parsedValue === null) {
        setFromDefault(userDefault);
        return;
      }
      if (lastSetByDefaultRef.current && parsedValue !== userDefault) {
        setFromDefault(userDefault);
      }
      return;
    }
    if (parsedValue === null) {
      setFromDefault(shareInfoPubliclyToggle.fallbackDefault);
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

  return {
    label,
    description,
    value:
      parsedValue ?? userDefault ?? shareInfoPubliclyToggle.fallbackDefault,
    disabled: Boolean(disabled || user?.anonymous),
    toggle: (next: boolean) => {
      lastSetByDefaultRef.current = false;
      onChange(next ? "true" : "false");
    },
  };
}
