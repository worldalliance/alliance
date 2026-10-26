import { z } from "zod";

export const DEVICE_VISIBILITY_TARGETS = [
  "mobile",
  "tablet",
  "desktop",
] as const;
export const deviceVisibilityTargetSchema = z.enum(DEVICE_VISIBILITY_TARGETS);
export type DeviceVisibilityTarget = z.infer<
  typeof deviceVisibilityTargetSchema
>;
