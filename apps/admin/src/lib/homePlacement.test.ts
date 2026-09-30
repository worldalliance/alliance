import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { describe, expect, it } from "bun:test";
import {
  actionHomePlacement,
  followUpHomePlacement,
  generalUpdateHomePlacement,
  InactiveReason,
  PlacementBadge,
} from "./homePlacement";
import { adminActionListItem } from "./testing/adminActionListItem";

const now = new Date("2026-06-15T00:00:00.000Z");
const past = "2026-06-01T00:00:00.000Z";
const closed = "2026-06-10T00:00:00.000Z";
const future = "2026-07-01T00:00:00.000Z";

const placementOf = (
  overrides: Parameters<typeof adminActionListItem>[2] = {},
) =>
  actionHomePlacement({ action: adminActionListItem(1, "A", overrides), now });

describe("actionHomePlacement", () => {
  it("marks an open action as an active task", () => {
    expect(
      placementOf({
        events: [makeEvent({ newStatus: "member_action", date: past })],
      }),
    ).toEqual({ badges: [PlacementBadge.ActiveTask], inactive: null });
  });

  it("keeps a closed action shown after its deadline", () => {
    expect(
      placementOf({
        shouldCompleteAfterDeadline: true,
        events: [
          makeEvent({ newStatus: "member_action", date: past }),
          makeEvent({ newStatus: "completed", date: closed }),
        ],
      }),
    ).toEqual({
      badges: [PlacementBadge.AvailableAfterDeadline],
      inactive: null,
    });
  });

  it("drops a closed action not shown after its deadline", () => {
    expect(
      placementOf({
        events: [
          makeEvent({ newStatus: "member_action", date: past }),
          makeEvent({ newStatus: "office_action", date: closed }),
        ],
      }),
    ).toEqual({ badges: [], inactive: InactiveReason.Closed });
  });

  it("drops an action moved back to draft after it opened", () => {
    expect(
      placementOf({
        shouldCompleteAfterDeadline: true,
        events: [
          makeEvent({ newStatus: "member_action", date: past }),
          makeEvent({ newStatus: "draft", date: closed }),
        ],
      }),
    ).toEqual({ badges: [], inactive: InactiveReason.Closed });
  });

  it("drops an action shown after its deadline that never opened", () => {
    expect(
      placementOf({
        shouldCompleteAfterDeadline: true,
        events: [makeEvent({ newStatus: "abandoned", date: past })],
      }),
    ).toEqual({ badges: [], inactive: InactiveReason.Closed });
  });

  it("marks a future opening as scheduled with its staff preview", () => {
    expect(
      placementOf({
        staffPreview: true,
        onboarding: true,
        events: [makeEvent({ newStatus: "member_action", date: future })],
      }),
    ).toEqual({
      badges: [
        PlacementBadge.Onboarding,
        PlacementBadge.Scheduled,
        PlacementBadge.StaffPreview,
      ],
      inactive: null,
    });
  });

  it("reads the status from the events at the given time", () => {
    expect(
      placementOf({
        status: "draft",
        events: [makeEvent({ newStatus: "member_action", date: past })],
      }).badges,
    ).toEqual([PlacementBadge.ActiveTask]);
  });

  it("doesn't call a completion-blocked preview scheduled for members", () => {
    expect(
      placementOf({
        preventCompletion: true,
        staffPreview: true,
        events: [makeEvent({ newStatus: "member_action", date: future })],
      }).badges,
    ).toEqual([PlacementBadge.StaffPreview]);
  });

  it("keeps an unscheduled draft orderable", () => {
    expect(placementOf()).toEqual({
      badges: [PlacementBadge.Draft],
      inactive: null,
    });
  });

  it("gives the reason an action can't reach member homes", () => {
    const open = {
      events: [makeEvent({ newStatus: "member_action", date: past })],
    };
    expect(placementOf({ ...open, archived: true }).inactive).toBe(
      InactiveReason.Archived,
    );
    expect(placementOf({ ...open, publicOnly: true }).inactive).toBe(
      InactiveReason.PublicOnly,
    );
    expect(placementOf({ ...open, preventCompletion: true }).inactive).toBe(
      InactiveReason.CompletionBlocked,
    );
  });

  it("keeps a completion-blocked action in staff preview", () => {
    expect(
      placementOf({ preventCompletion: true, staffPreview: true }),
    ).toEqual({
      badges: [PlacementBadge.Draft, PlacementBadge.StaffPreview],
      inactive: null,
    });
  });

  it("blocks a completion-blocked action once its preview has opened", () => {
    expect(
      placementOf({
        preventCompletion: true,
        staffPreview: true,
        events: [makeEvent({ newStatus: "member_action", date: past })],
      }).inactive,
    ).toBe(InactiveReason.CompletionBlocked);
  });
});

describe("generalUpdateHomePlacement", () => {
  const placement = (startDate?: string, endDate?: string) =>
    generalUpdateHomePlacement({ generalUpdate: { startDate, endDate }, now });

  it("reads its state from its dates", () => {
    expect(placement().badges).toEqual([PlacementBadge.Unscheduled]);
    expect(placement(future).badges).toEqual([PlacementBadge.Scheduled]);
    expect(placement(past, future).badges).toEqual([PlacementBadge.Active]);
    expect(placement(past, past).inactive).toBe(InactiveReason.Expired);
  });
});

describe("followUpHomePlacement", () => {
  const cohortExpression = { type: "all" };
  const placement = (
    followUpForm: {
      startDate: string | null;
      endDate?: string | null;
      cohortExpression?: { type: string } | null;
    },
    parent: Parameters<typeof adminActionListItem>[2] = {},
  ) =>
    followUpHomePlacement({
      followUpForm: { endDate: null, cohortExpression, ...followUpForm },
      parent: adminActionListItem(1, "A", {
        events: [makeEvent({ newStatus: "member_action", date: past })],
        ...parent,
      }),
      now,
    });

  it("lists active and scheduled follow-ups", () => {
    expect(placement({ startDate: past }).badges).toEqual([
      PlacementBadge.Active,
    ]);
    expect(placement({ startDate: future }).badges).toEqual([
      PlacementBadge.Scheduled,
    ]);
  });

  it("schedules an open follow-up until its parent opens", () => {
    const opensLater = {
      events: [makeEvent({ newStatus: "member_action", date: future })],
    };
    expect(placement({ startDate: past }, opensLater).badges).toEqual([
      PlacementBadge.Scheduled,
    ]);
    expect(
      placement({ startDate: past, endDate: closed }, opensLater).inactive,
    ).toBe(InactiveReason.EndsBeforeParentOpens);
  });

  it("schedules a follow-up whose parent reopens after a draft", () => {
    expect(
      placement(
        { startDate: past },
        {
          events: [
            makeEvent({ newStatus: "member_action", date: past }),
            makeEvent({ newStatus: "draft", date: closed }),
            makeEvent({ newStatus: "member_action", date: future }),
          ],
        },
      ).badges,
    ).toEqual([PlacementBadge.Scheduled]);
  });

  it("gives the reason a follow-up isn't shown", () => {
    expect(placement({ startDate: null }).inactive).toBe(
      InactiveReason.Unscheduled,
    );
    expect(placement({ startDate: past, endDate: past }).inactive).toBe(
      InactiveReason.Expired,
    );
    expect(placement({ startDate: future, endDate: past }).inactive).toBe(
      InactiveReason.EndsBeforeStart,
    );
    expect(
      placement({ startDate: past, cohortExpression: null }).inactive,
    ).toBe(InactiveReason.NoCohort);
    expect(placement({ startDate: past }, { archived: true }).inactive).toBe(
      InactiveReason.ParentArchived,
    );
    expect(placement({ startDate: past }, { publicOnly: true }).inactive).toBe(
      InactiveReason.ParentPublicOnly,
    );
    expect(placement({ startDate: past }, { events: [] }).inactive).toBe(
      InactiveReason.ParentUnscheduled,
    );
    expect(
      placement(
        { startDate: past },
        {
          events: [
            makeEvent({ newStatus: "member_action", date: past }),
            makeEvent({ newStatus: "draft", date: closed }),
          ],
        },
      ).inactive,
    ).toBe(InactiveReason.ParentDraft);
    expect(
      placement(
        { startDate: future },
        {
          events: [
            makeEvent({ newStatus: "member_action", date: past }),
            makeEvent({ newStatus: "draft", date: closed }),
          ],
        },
      ).inactive,
    ).toBe(InactiveReason.ParentDraft);
  });
});
