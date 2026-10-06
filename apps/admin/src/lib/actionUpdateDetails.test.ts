import type { ContributionFormula } from "@alliance/common/forms/contribution-formula";
import type {
  AdminActionUpdateDto,
  UpdateActionUpdateDto,
} from "@alliance/shared/client";
import { captureErrors } from "@alliance/shared/lib/testing/captureErrors";
import {
  activeFormula,
  checkBlockedReasonOf,
  detailsBody,
  formOf,
  notifyBlockedReasonOf,
  recognitionModeOf,
  withActiveFormula,
  type ContributionFormulas,
} from "./actionUpdateDetails";

const LETTERS = {
  inputs: { input1: { kind: "field", fieldId: "letters" } },
  formula: 'input1 + " letters"',
} satisfies ContributionFormula;

const update = (
  overrides: Partial<AdminActionUpdateDto> = {},
): AdminActionUpdateDto => ({
  id: 1,
  actionId: 2,
  title: "Hearing",
  schemaSnapshotId: 3,
  date: "2026-10-01T00:00:00.000Z",
  visibleAt: null,
  shortNotifString: "a hearing on the bill",
  associatedEventId: null,
  notifyType: "all_members",
  notifiedAt: null,
  schema: {},
  notificationMode: "normal",
  contributionFormula: LETTERS,
  retrospectiveContributionFormula: null,
  recognitionPreparedAt: null,
  notificationHeldReason: null,
  ...overrides,
});

describe("detailsBody", () => {
  it("saves the mode and both formulas of a recognition update", () => {
    expect(detailsBody(formOf(update()))).toMatchObject({
      notificationMode: "normal",
      contributionFormula: LETTERS,
      retrospectiveContributionFormula: null,
    });
  });

  it("leaves both formulas alone when a saved one can't be read", () => {
    let body: UpdateActionUpdateDto = {};
    const logged = captureErrors(() => {
      body = detailsBody(
        formOf(update({ retrospectiveContributionFormula: { formula: 7 } })),
      );
    });
    expect(logged).toHaveLength(1);
    expect(body.notificationMode).toBe("normal");
    expect(body).not.toHaveProperty("contributionFormula");
    expect(body).not.toHaveProperty("retrospectiveContributionFormula");
  });

  it("sends no recognition fields for a legacy update", () => {
    const body = detailsBody(formOf(update({ notificationMode: "legacy" })));
    expect(body).not.toHaveProperty("notificationMode");
    expect(body).not.toHaveProperty("contributionFormula");
  });
});

describe("activeFormula", () => {
  const formulas: ContributionFormulas = {
    contributionFormula: LETTERS,
    retrospectiveContributionFormula: null,
  };
  const sent = { inputs: {}, formula: '"sent letters"' };

  it("reads and writes the normal formula in normal mode", () => {
    expect(activeFormula(formulas, "normal")).toBe(LETTERS);
    expect(
      withActiveFormula({ formulas, mode: "normal", formula: sent }),
    ).toEqual({ ...formulas, contributionFormula: sent });
  });

  it("reads and writes the retrospective formula in retrospective mode", () => {
    expect(activeFormula(formulas, "retrospective")).toBeNull();
    expect(
      withActiveFormula({ formulas, mode: "retrospective", formula: sent }),
    ).toEqual({ ...formulas, retrospectiveContributionFormula: sent });
  });
});

describe("recognitionModeOf", () => {
  it("has no recognition mode for a legacy update", () => {
    expect(recognitionModeOf("legacy")).toBeNull();
    expect(recognitionModeOf("retrospective")).toBe("retrospective");
  });
});

describe("notifyBlockedReasonOf", () => {
  const sendable = {
    notifyType: "all_members",
    formulasReadable: true,
    hasUnsavedDetails: false,
    hasBody: true,
  } as const;

  it("allows sending a saved update with an audience, readable formulas and a body", () => {
    expect(notifyBlockedReasonOf(sendable)).toBeNull();
  });

  it("refuses to send a formula this build can't read", () => {
    expect(
      notifyBlockedReasonOf({ ...sendable, formulasReadable: false }),
    ).toBe("A saved contribution formula can't be read here.");
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
});

describe("checkBlockedReasonOf", () => {
  it("checks only a saved update with an audience", () => {
    expect(
      checkBlockedReasonOf({ notifyType: "tag", hasUnsavedDetails: false }),
    ).toBeNull();
    expect(
      checkBlockedReasonOf({ notifyType: "none", hasUnsavedDetails: false }),
    ).toMatch(/Pick an audience/);
    expect(
      checkBlockedReasonOf({ notifyType: "tag", hasUnsavedDetails: true }),
    ).toMatch(/Save your changes before checking/);
  });
});
