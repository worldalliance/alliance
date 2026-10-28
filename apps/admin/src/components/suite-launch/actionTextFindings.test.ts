import { describe, expect, it } from "bun:test";
import {
  actionTextFindings,
  findingContext,
  TextSource,
} from "./actionTextFindings";
import { TextIssueKind } from "./textChecks";

const action = {
  id: 7,
  name: "Call  Congress",
  shortDescription: "A short one.",
  body: "Some body text that is long enough to need context on both sides of the the issue here.",
};

describe("actionTextFindings", () => {
  it("checks the name, short description, body, and task form", () => {
    const findings = actionTextFindings({
      action,
      taskFormSchema: {
        pages: [{ id: "p1", title: "Page  one", fields: [] }],
        outputViews: [],
      },
    });
    expect(findings.map((finding) => [finding.source, finding.kind])).toEqual([
      [TextSource.Name, TextIssueKind.DoubleSpace],
      [TextSource.Body, TextIssueKind.RepeatedWord],
      [TextSource.TaskForm, TextIssueKind.DoubleSpace],
    ]);
  });

  it("shows the flagged text with surrounding context", () => {
    const [, body] = actionTextFindings({ action, taskFormSchema: null });
    expect(findingContext(body)).toEqual({
      before: "xt on both sides of ",
      flagged: "the the",
      after: " issue here.",
    });
  });

  it("keys a finding by its context, not its offset", () => {
    const [, before] = actionTextFindings({ action, taskFormSchema: null });
    const [, after] = actionTextFindings({
      action: { ...action, body: `Intro paragraph. ${action.body}` },
      taskFormSchema: null,
    });
    expect(after.start).not.toBe(before.start);
    expect(after.key).toBe(before.key);
  });

  it("keys a finding repeated in identical context apart from the first", () => {
    const findings = actionTextFindings({
      action,
      taskFormSchema: {
        pages: [
          { id: "p1", title: "Page  one", fields: [] },
          { id: "p2", title: "Page  one", fields: [] },
        ],
        outputViews: [],
      },
    });
    const keys = findings.map((finding) => finding.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
