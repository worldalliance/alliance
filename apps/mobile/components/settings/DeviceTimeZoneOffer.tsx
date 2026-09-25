import { deviceTimeZoneOffer } from "@alliance/shared/forms/deviceTimeZoneOffer";
import { View } from "react-native";
import { getDeviceTimeZone } from "../../lib/timeZone";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text from "../system/Text";

type Props = {
  saved: string | undefined;
  onUse: (tz: string) => void;
};

export default function DeviceTimeZoneOffer({ saved, onUse }: Props) {
  const offer = deviceTimeZoneOffer({ saved, device: getDeviceTimeZone() });
  if (!offer) return null;
  return (
    <View className="flex-row items-center gap-3 mt-2">
      <Text className="flex-1 text-sm text-zinc-600">
        Device timezone: {offer.label}
      </Text>
      <Button
        onPress={() => onUse(offer.tz)}
        title="Use"
        color={ButtonColor.Outline}
        size={ButtonSize.Small}
      />
    </View>
  );
}
