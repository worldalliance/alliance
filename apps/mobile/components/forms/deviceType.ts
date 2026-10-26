import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
import { DeviceType, deviceType as expoDeviceType } from "expo-device";

const detectDeviceType = (): DeviceVisibilityTarget => {
  if (expoDeviceType === null) return "mobile";
  switch (expoDeviceType) {
    case DeviceType.PHONE:
      return "mobile";
    case DeviceType.TABLET:
      return "tablet";
    case DeviceType.DESKTOP:
      return "desktop";
    case DeviceType.UNKNOWN:
    case DeviceType.TV:
      return "mobile";
    default:
      throw new Error(`unknown device type: ${expoDeviceType satisfies never}`);
  }
};

export const DEVICE_TYPE: DeviceVisibilityTarget = detectDeviceType();
