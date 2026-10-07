import type { ActionSuite } from "src/actions/entities/action-suite.entity";
import { Action } from "src/actions/entities/action.entity";
import type { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import type { SuiteOutcome } from "src/actions/missed-suite-streak";
import { processKeywordReplacements } from "src/mail/mail.service";
import { User } from "src/user/entities/user.entity";
import { MissedSuiteNoticeCopy } from "./entities/action-event-notif.entity";
import {
  MissedSuitePlanKind,
  missedSuiteNoticeTemplates,
  resolveMissedSuitePlan,
} from "./missed-suite-notice";

const group = {
  pushMessage: "group push",
  textMessage: "group text",
  emailSubject: "group subject",
  emailMessage: "group body #{missedactioncontext}",
};

function render(copy: MissedSuiteNoticeCopy, taskNames: string[]) {
  const templates = missedSuiteNoticeTemplates(copy, group);
  const fill = (template: string) =>
    processKeywordReplacements(template, {
      user: { id: 1, name: "Jane Doe" } as User,
      action: { id: 10, name: "Test Action" } as Action,
      cid: "test-cid",
      uncompletedTasksCount: taskNames.length,
      uncompletedTasksTime: "0 minutes",
      uncompletedTasksNames: taskNames,
    });
  return {
    push: fill(templates.pushMessage),
    text: fill(templates.textMessage),
    emailSubject: fill(templates.emailSubject),
    emailMessage: fill(templates.emailMessage),
  };
}

describe("missedSuiteNoticeTemplates", () => {
  let originalAppUrl: string | undefined;

  beforeAll(() => {
    originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = "https://app.example.org";
  });

  afterAll(() => {
    process.env.APP_URL = originalAppUrl;
  });

  it("sends the control the group's configured copy", () => {
    expect(
      missedSuiteNoticeTemplates(MissedSuiteNoticeCopy.FirstMissControl, group),
    ).toEqual(group);
  });

  it("renders the first-miss report copy for one missed task", () => {
    const notice = render(MissedSuiteNoticeCopy.FirstMissReportV1, ["Call"]);
    expect(notice.push).toBe(
      "The deadline for Call passed without your completion.",
    );
    expect(notice.emailSubject).toBe(notice.push);
    expect(notice.text).toContain(
      "The deadline for Call passed without your completion. If you did complete it, contact us. https://app.example.org/",
    );
    expect(notice.emailMessage).toContain(
      "Hi Jane,\nThe deadline for Call passed and we have no completion recorded for you. If you did complete it, contact us; we may have made a mistake.\nEach action is planned around the number of members expected to participate.\nhttps://app.example.org/",
    );
  });

  it("pluralizes the first-miss report copy for several missed tasks", () => {
    const notice = render(MissedSuiteNoticeCopy.FirstMissReportV1, [
      "Call",
      "Write",
    ]);
    expect(notice.emailSubject).toBe(
      "The deadline for Call, Write passed without your completion.",
    );
    expect(notice.text).toContain("If you did complete them, contact us.");
    expect(notice.emailMessage).toContain(
      "If you did complete them, contact us;",
    );
  });

  it("renders the second-miss report copy", () => {
    const notice = render(MissedSuiteNoticeCopy.SecondMissReportV1, ["Call"]);
    expect(notice.push).toBe(
      "You have missed two consecutive weeks. One more pauses your agreement automatically.",
    );
    expect(notice.emailSubject).toBe(
      "You have missed two consecutive weeks of tasks.",
    );
    expect(notice.emailMessage).toContain("Hi Jane,\nYou have missed");
    expect(notice.emailMessage).toContain(
      "Completing this week's tasks resets the count.",
    );
    expect(notice.text).toContain("https://app.example.org/");
  });
});

describe("resolveMissedSuitePlan", () => {
  const suite = { id: 7 } as ActionSuite;
  const outcome = (suiteId: number): SuiteOutcome => ({
    suiteId,
    closedAt: new Date(0),
    onboarding: false,
    actions: [{ id: 1, name: "Task" }],
    missedActionIdsByUser: new Map([[5, [1]]]),
    completedUserIds: new Set(),
  });
  const resolve = (
    overrides: Partial<Pick<ReminderGroup, "actionSuite" | "emailMessage">>,
    closedSuites: SuiteOutcome[],
  ) =>
    resolveMissedSuitePlan({
      group: { ...group, actionSuite: suite, ...overrides },
      userId: 5,
      closedSuites,
    });

  it("leaves a group without the missed-suite keywords to ordinary dispatch", () => {
    expect(resolve({ emailMessage: "plain" }, [outcome(7)])).toEqual({
      kind: MissedSuitePlanKind.Ordinary,
    });
  });

  it("tells a group without a suite from one whose suite is still open", () => {
    expect(resolve({ actionSuite: undefined }, [outcome(7)])).toEqual({
      kind: MissedSuitePlanKind.NoSuite,
    });
    expect(resolve({}, [outcome(8)])).toEqual({
      kind: MissedSuitePlanKind.SuiteOpen,
      suite,
    });
  });

  it("gives the member's standing once the suite has closed", () => {
    expect(resolve({}, [outcome(7)])).toMatchObject({
      kind: MissedSuitePlanKind.Due,
      suite,
      standing: { missNumber: 1 },
    });
  });
});
