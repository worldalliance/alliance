import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { useShareInfoPubliclyToggle } from "@alliance/shared/forms/useShareInfoPubliclyToggle";
import { CardStyle } from "@alliance/shared/styles/card";
import { Switch, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Card from "../system/Card";
import Text, { FontWeight } from "../system/Text";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

const ShareInfoPubliclyToggleComponent = (props: CustomComponentProps) => {
  const { field, isOutputView, required } = props;
  const toggle = useShareInfoPubliclyToggle(props);

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
          {toggle.label}
        </Text>
        <Text className="text-zinc-500">{toggle.description}</Text>
      </View>
      <Switch
        value={toggle.value}
        onValueChange={toggle.toggle}
        disabled={toggle.disabled}
        trackColor={{ true: colors.green, false: colors.switch.trackOff }}
        ios_backgroundColor={colors.switch.trackOff}
        thumbColor={colors.white}
        accessibilityLabel={toggle.label}
      />
    </Card>
  );
};

export default ShareInfoPubliclyToggleComponent;
