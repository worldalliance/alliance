import type { MmsMessageDto } from "@alliance/shared/client/types.gen";
import { deliveryStatus, mergeTexts } from "./memberTexts";

describe("deliveryStatus", () => {
  it("names a failure with Twilio's reason", () => {
    expect(
      deliveryStatus({
        status: "undelivered",
        errorCode: 30003,
        errorMessage: "Unreachable destination handset",
      }),
    ).toEqual({
      label: "Not delivered",
      failed: true,
      reason: "Unreachable destination handset",
    });
  });

  it("falls back to the error code when Twilio gave no message", () => {
    expect(
      deliveryStatus({ status: "failed", errorCode: 21610, errorMessage: null })
        .reason,
    ).toBe("Twilio error 21610");
  });

  it("shows a status it doesn't know as-is", () => {
    expect(
      deliveryStatus({
        status: "teleported",
        errorCode: null,
        errorMessage: null,
      }).label,
    ).toBe("teleported");
  });
});

describe("mergeTexts", () => {
  const text = (
    id: number,
    createdAt: string,
    status = "sent",
  ): MmsMessageDto => ({
    id,
    direction: "outbound",
    body: "",
    status,
    errorCode: null,
    errorMessage: null,
    createdAt,
    sentByStaff: false,
    sentByName: null,
    media: [],
  });

  it("orders by time then id, taking a shared text from the newer list", () => {
    const merged = mergeTexts({
      older: [
        text(3, "2026-01-01T00:01:00Z"),
        text(2, "2026-01-01T00:00:00Z", "queued"),
      ],
      newer: [
        text(2, "2026-01-01T00:00:00Z", "delivered"),
        text(1, "2026-01-01T00:00:00Z"),
      ],
    });
    expect(merged.map((t) => [t.id, t.status])).toEqual([
      [1, "sent"],
      [2, "delivered"],
      [3, "sent"],
    ]);
  });
});
