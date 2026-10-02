import type { ActionSuite } from "src/actions/entities/action-suite.entity";
import { Action } from "src/actions/entities/action.entity";
import { processKeywordReplacements } from "src/mail/mail.service";
import { User } from "src/user/entities/user.entity";
import { MissedSuiteNoticeCopy } from "./entities/action-event-notif.entity";
import {
  closedNoticeSuite,
  missedSuiteNoticeTemplates,
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
    expect(notice.text).toContain("https://app.example.org/");
  });
});

describe("closedNoticeSuite", () => {
  const suite = { id: 7 } as ActionSuite;

  it("returns the group's suite once it has closed", () => {
    expect(closedNoticeSuite({ actionSuite: suite }, [{ suiteId: 7 }])).toEqual(
      { ok: true, value: suite },
    );
  });

  it("refuses a group without a suite or before its suite closes", () => {
    expect(closedNoticeSuite({}, [{ suiteId: 7 }])).toEqual({
      ok: false,
      error: "has no suite",
    });
    expect(closedNoticeSuite({ actionSuite: suite }, [{ suiteId: 8 }])).toEqual(
      {
        ok: false,
        error:
          "suite 7 has not closed: a required action has a later deadline than this group, or none",
      },
    );
  });
});
