import { ActionEvent, ActionStatus } from "./entities/action-event.entity";
import { isStaffPreviewActive } from "./staff-preview";

const NOW = new Date("2026-01-08T00:00:00Z");

const memberActionAt = (date: Date): ActionEvent =>
  Object.assign(new ActionEvent(), {
    date,
    newStatus: ActionStatus.MemberAction,
  });

describe("isStaffPreviewActive", () => {
  it("is inactive with the toggle off", () => {
    expect(
      isStaffPreviewActive(
        {
          staffPreview: false,
          events: [memberActionAt(new Date("2026-01-10T00:00:00Z"))],
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("is active with the toggle on and no member_action event", () => {
    expect(isStaffPreviewActive({ staffPreview: true, events: [] }, NOW)).toBe(
      true,
    );
  });

  it("is active before the member_action event starts", () => {
    expect(
      isStaffPreviewActive(
        {
          staffPreview: true,
          events: [memberActionAt(new Date("2026-01-10T00:00:00Z"))],
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("is inactive once the member_action event starts", () => {
    expect(
      isStaffPreviewActive(
        { staffPreview: true, events: [memberActionAt(NOW)] },
        NOW,
      ),
    ).toBe(false);
  });
});
