import {
  deviceVisibilityTargetSchema,
  type DeviceVisibilityTarget,
} from "@alliance/common/forms/device";
import { type FormResponseDto } from "@alliance/shared/client";
import { useEffect, useState } from "react";

const DEFAULT_DEVICE_TYPE: DeviceVisibilityTarget = "desktop";

const detectDeviceType = (): DeviceVisibilityTarget => {
  if (typeof window === "undefined") {
    return DEFAULT_DEVICE_TYPE;
  }
  const width = window.innerWidth;
  if (width < 640) {
    return "mobile";
  }
  if (width < 1024) {
    return "tablet";
  }
  return "desktop";
};

/**
 * `deviceType` is the viewport's, tracked across resizes while the form is
 * editable. `effectiveDeviceType`, which visibility reads, is the one a
 * completed response was submitted from, when it saved one.
 */
export function useDeviceType({
  readOnly,
  completedFormResponse,
}: {
  readOnly: boolean;
  completedFormResponse?: FormResponseDto;
}) {
  const [deviceType, setDeviceType] = useState<DeviceVisibilityTarget>(() =>
    detectDeviceType(),
  );

  useEffect(() => {
    if (readOnly || typeof window === "undefined") {
      return;
    }
    const updateDeviceType = () => {
      setDeviceType(detectDeviceType());
    };
    updateDeviceType();
    window.addEventListener("resize", updateDeviceType);
    return () => {
      window.removeEventListener("resize", updateDeviceType);
    };
  }, [readOnly]);

  const savedDeviceType = deviceVisibilityTargetSchema.safeParse(
    completedFormResponse?.deviceType,
  ).data;

  const effectiveDeviceType = readOnly
    ? (savedDeviceType ?? deviceType)
    : deviceType;

  return { deviceType, effectiveDeviceType };
}
