import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { shareInfoPubliclyToggle } from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import { useEffect, useRef } from "react";
import { Switch, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Card from "../system/Card";
import Text, { FontWeight } from "../system/Text";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

const parseBooleanValue = (value: string | null): boolean | null => {
  if (value === "true") return true;
  if (value === "false") return false;
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
  const resolvedValue =
    parsedValue ?? userDefault ?? shareInfoPubliclyToggle.fallbackDefault;
  const isDisabled = Boolean(disabled || user?.anonymous);

  return (
    <Card
      cardStyle={CardStyle.White}
      className="flex-row items-center justify-between gap-x-4"
    >
      <View className="flex-1">
        {!(required ?? field.required) && !isOutputView && (
          <OptionalLabelPrefix />
        )}
        <Text className="mb-1" weight={FontWeight.Medium}>
          {label}
        </Text>
        <Text className="text-zinc-500">{description}</Text>
      </View>
      <Switch
        value={resolvedValue}
        onValueChange={(next) => {
          lastSetByDefaultRef.current = false;
          onChange(next ? "true" : "false");
        }}
        disabled={isDisabled}
        trackColor={{ true: colors.green, false: colors.switch.trackOff }}
        ios_backgroundColor={colors.switch.trackOff}
        thumbColor={colors.white}
        accessibilityLabel={label}
      />
    </Card>
  );
};

export default ShareInfoPubliclyToggleComponent;
