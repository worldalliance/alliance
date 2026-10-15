import type { AdminActionUpdateDto } from "@alliance/shared/client";

export const actionUpdateAdmin = (
  overrides: Partial<AdminActionUpdateDto> = {},
): AdminActionUpdateDto => ({
  id: 1,
  actionId: 2,
  title: "Hearing",
  schemaSnapshotId: 3,
  date: "2026-10-01T00:00:00.000Z",
  visibleAt: null,
  shortNotifString: "a hearing on the bill",
  splitCollectiveResult: false,
  nonCompleterResult: null,
  uninvolvedResult: null,
  associatedEventId: null,
  notifyType: "all_members",
  notifiedAt: null,
  schema: {
    blocks: [{ type: "display", kind: "header", id: "b1", text: "Body" }],
  },
  notificationMode: "normal",
  recognitionPreparedAt: null,
  notificationHeldReason: null,
  ...overrides,
});
