import { otaUpdateProperties } from "./otaUpdateProperties";

describe("otaUpdateProperties", () => {
  it("names the downloaded update a launch runs", () => {
    expect(
      otaUpdateProperties({
        isEnabled: true,
        updateId: "0b1c2d3e-0000-4000-8000-000000000000",
        createdAt: new Date("2026-11-17T18:00:00Z"),
        channel: "production",
        runtimeVersion: "fingerprint-abc",
        isEmbeddedLaunch: false,
        isEmergencyLaunch: false,
        emergencyLaunchReason: null,
      }),
    ).toEqual({
      ota_updates_enabled: true,
      ota_update_id: "0b1c2d3e-0000-4000-8000-000000000000",
      ota_update_created_at: "2026-11-17T18:00:00.000Z",
      ota_channel: "production",
      ota_runtime_version: "fingerprint-abc",
      ota_is_embedded_launch: false,
      ota_is_emergency_launch: false,
      ota_emergency_launch_reason: null,
    });
  });

  it("reports an emergency launch with its reason", () => {
    expect(
      otaUpdateProperties({
        isEnabled: true,
        updateId: "embedded-id",
        createdAt: null,
        channel: "production",
        runtimeVersion: "fingerprint-abc",
        isEmbeddedLaunch: true,
        isEmergencyLaunch: true,
        emergencyLaunchReason: "update failed to load",
      }),
    ).toMatchObject({
      ota_update_created_at: null,
      ota_is_embedded_launch: true,
      ota_is_emergency_launch: true,
      ota_emergency_launch_reason: "update failed to load",
    });
  });
});
