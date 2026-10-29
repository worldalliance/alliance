import { describe, expect, it } from "bun:test";
import { TextSource } from "./actionTextFindings";
import { launchBlockers } from "./launchBlockers";
import { TextIssueKind } from "./textChecks";

const now = new Date("2026-01-15T18:00:00Z");
const schedule = {
  memberActionAt: new Date("2026-01-16T03:00:00Z"),
  officeActionAt: new Date("2026-01-23T07:59:00Z"),
};
const action = { id: 1 };
const finding = {
  key: "f1",
  dismissKey: "f1",
  actionId: 1,
  source: TextSource.Body,
  text: "a  b",
  kind: TextIssueKind.DoubleSpace,
  start: 1,
  end: 3,
};

const ready = {
  data: {
    actions: [{ action, unready: [] }],
    loads: [
      {
        userId: 9,
        actionIds: [1],
        minutes: 10,
      },
    ],
    recipientCount: 1,
    textFindings: [finding],
    errors: [],
    loading: false,
    spellcheckLoading: false,
  },
  schedule,
  reminderWindows: [],
  hasMemberActionEvent: false,
  checkedActionIds: new Set([1]),
  dismissedFindingKeys: new Set(["f1"]),
  violationsAcknowledged: false,
  now,
};

describe("launchBlockers", () => {
  it("allows launch once every check passes", () => {
    expect(launchBlockers(ready)).toEqual([]);
  });

  it("never launches a suite twice", () => {
    expect(launchBlockers({ ...ready, hasMemberActionEvent: true })).toEqual([
      "This suite already has a members taking action event.",
    ]);
  });

  it("waits for checks to load", () => {
    expect(
      launchBlockers({ ...ready, data: { ...ready.data, loading: true } }),
    ).toEqual(["Checks are loading."]);
    expect(
      launchBlockers({
        ...ready,
        data: { ...ready.data, spellcheckLoading: true },
      }),
    ).toEqual(["Checks are loading."]);
  });

  it("blocks on each unresolved check", () => {
    expect(
      launchBlockers({
        ...ready,
        data: {
          ...ready.data,
          actions: [
            {
              action,
              unready: [
                { id: "body", label: "Full body content", isReady: false },
              ],
            },
          ],
          loads: [
            {
              userId: 9,
              actionIds: [1],
              minutes: 16,
            },
          ],
          errors: ["Failed to load action A."],
        },
        checkedActionIds: new Set(),
        dismissedFindingKeys: new Set(),
      }),
    ).toEqual([
      "Some checks failed to load.",
      "1 action has unfinished checklist items.",
      "1 contract violation to fix or accept.",
      "1 action isn't marked ready to launch.",
      "1 text finding to fix or dismiss.",
    ]);
  });

  it("lets acknowledged contract violations through", () => {
    expect(
      launchBlockers({
        ...ready,
        data: {
          ...ready.data,
          loads: [
            {
              userId: 9,
              actionIds: [1],
              minutes: 16,
            },
          ],
        },
        violationsAcknowledged: true,
      }),
    ).toEqual([]);
  });

  it("blocks reminders that would send before members start", () => {
    expect(
      launchBlockers({
        ...ready,
        reminderWindows: [
          {
            name: "Early",
            start: new Date("2026-01-16T02:00:00Z"),
            end: new Date("2026-01-17T02:00:00Z"),
          },
        ],
      }),
    ).toEqual([
      "1 reminder would send before members start. Move office taking action later.",
    ]);
  });

  it("blocks a schedule in the past or out of order, and an empty audience", () => {
    expect(
      launchBlockers({
        ...ready,
        data: { ...ready.data, recipientCount: 0 },
        schedule: {
          memberActionAt: now,
          officeActionAt: new Date("2026-01-15T17:00:00Z"),
        },
      }),
    ).toEqual([
      "Members taking action must start in the future.",
      "Office taking action must come after members start.",
      "No member is assigned any action.",
    ]);
  });
});
