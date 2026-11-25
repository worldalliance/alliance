import type { AdminActionUpdateDto } from "@alliance/shared/client";
import {
  detailsBody,
  formOf,
  notifyBlockedReasonOf,
  usesRecognition,
} from "./actionUpdateDetails";

const update = (
  overrides: Partial<AdminActionUpdateDto> = {},
): AdminActionUpdateDto => ({
  id: 1,
  actionId: 2,
  title: "Hearing",
  schemaSnapshotId: 3,
  cardImage: null,
  date: "2026-10-01T00:00:00.000Z",
  visibleAt: null,
  shortNotifString: "a hearing on the bill",
  nonCompleterResult: null,
  associatedEventId: null,
  notifyType: "all_members",
  notifiedAt: null,
  schema: {},
  notificationMode: "normal",
  recognitionPreparedAt: null,
  notificationHeldReason: null,
  ...overrides,
});

describe("detailsBody", () => {
  it("saves the didn't-complete text", () => {
    expect(
      detailsBody(formOf(update({ nonCompleterResult: "without you" }))),
    ).toMatchObject({ nonCompleterResult: "without you" });
  });

  it("sends the card image only when it changed", () => {
    const form = formOf(update({}));
    expect("cardImage" in detailsBody(form)).toBe(false);
    expect(
      detailsBody({ ...form, cardImage: { kind: "set", key: "a.webp" } })
        .cardImage,
    ).toBe("a.webp");
    expect(
      detailsBody({ ...form, cardImage: { kind: "cleared" } }).cardImage,
    ).toBeNull();
  });

  it("sends no recognition fields for a legacy update", () => {
    const body = detailsBody(formOf(update({ notificationMode: "legacy" })));
    expect(body).not.toHaveProperty("nonCompleterResult");
  });
});

describe("usesRecognition", () => {
  it("is off only for legacy updates", () => {
    expect(usesRecognition("legacy")).toBe(false);
    expect(usesRecognition("normal")).toBe(true);
  });
});

describe("notifyBlockedReasonOf", () => {
  const sendable = {
    notifyType: "all_members",
    hasUnsavedDetails: false,
    hasBody: true,
    hasNotificationText: true,
  } as const;

  it("allows sending a saved update with an audience and a body", () => {
    expect(notifyBlockedReasonOf(sendable)).toBeNull();
  });

  it("names the audience, then unsaved edits, then the body", () => {
    expect(notifyBlockedReasonOf({ ...sendable, notifyType: "none" })).toMatch(
      /Pick an audience/,
    );
    expect(
      notifyBlockedReasonOf({ ...sendable, hasUnsavedDetails: true }),
    ).toMatch(/Save your changes/);
    expect(notifyBlockedReasonOf({ ...sendable, hasBody: false })).toMatch(
      /Write the update body/,
    );
  });

  it("asks for the notification text an update with no notification could skip", () => {
    expect(
      notifyBlockedReasonOf({ ...sendable, hasNotificationText: false }),
    ).toBe("Write the notification text and save before sending.");
  });
});
