import type * as Updates from "expo-updates";

type UpdatesConstants = Pick<
  typeof Updates,
  | "isEnabled"
  | "updateId"
  | "createdAt"
  | "channel"
  | "runtimeVersion"
  | "isEmbeddedLaunch"
  | "isEmergencyLaunch"
  | "emergencyLaunchReason"
>;

export const otaUpdateProperties = (updates: UpdatesConstants) => ({
  ota_updates_enabled: updates.isEnabled,
  ota_update_id: updates.updateId,
  ota_update_created_at: updates.createdAt?.toISOString() ?? null,
  ota_channel: updates.channel,
  ota_runtime_version: updates.runtimeVersion,
  ota_is_embedded_launch: updates.isEmbeddedLaunch,
  ota_is_emergency_launch: updates.isEmergencyLaunch,
  ota_emergency_launch_reason: updates.emergencyLaunchReason,
});
