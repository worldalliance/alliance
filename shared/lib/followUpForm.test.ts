import type { FollowUpFormDto } from "../client";
import {
  followUpDraftStorageKey,
  followUpFormIntro,
  getActiveFollowUpForms,
} from "./followUpForm";
import { makeAction, makeLegacyAction, makeViewer } from "./testFixtures";

describe("followUpDraftStorageKey", () => {
  it("names the draft the renderer saves under the follow-up's persist key", () => {
    expect(followUpDraftStorageKey({ formId: 2, followUpFormId: 5 })).toBe(
      "form:2:follow-up-5",
    );
  });
});

describe("followUpFormIntro", () => {
  const followUp = (
    overrides: Partial<Pick<FollowUpFormDto, "name" | "instructions">>,
  ) => ({ name: null, instructions: null, ...overrides });

  it("falls back to the form's title and hides blank instructions", () => {
    expect(
      followUpFormIntro(followUp({ instructions: "  " }), "Survey"),
    ).toEqual({ title: "Survey", hasInstructions: false, shown: true });
  });

  it("prefers the follow-up's own name and shows its instructions", () => {
    expect(
      followUpFormIntro(
        followUp({ name: "Check-in", instructions: "Tell us more" }),
        "Survey",
      ),
    ).toEqual({ title: "Check-in", hasInstructions: true, shown: true });
  });

  it("is hidden with no title and no instructions", () => {
    expect(followUpFormIntro(followUp({}), "").shown).toBe(false);
  });
});

describe("getActiveFollowUpForms", () => {
  const followUp = (
    overrides: Pick<FollowUpFormDto, "id" | "startDate">,
  ): FollowUpFormDto => ({
    name: null,
    endDate: null,
    instructions: null,
    actionId: 1,
    formId: 1,
    ...overrides,
  });
  const open = followUp({ id: 1, startDate: "2000-01-01T00:00:00.000Z" });
  const unopened = followUp({ id: 2, startDate: null });
  const followUpForms = [open, unopened];

  it("lists the open follow-ups once the viewer completed the action", () => {
    expect(
      getActiveFollowUpForms(
        makeAction({
          followUpForms,
          viewer: makeViewer({ relation: "completed" }),
        }),
      ),
    ).toEqual([open]);
    expect(
      getActiveFollowUpForms(
        makeLegacyAction({ followUpForms, userRelation: "completed" }),
      ),
    ).toEqual([open]);
  });

  it("lists none before the viewer completed the action", () => {
    expect(
      getActiveFollowUpForms(
        makeAction({
          followUpForms,
          viewer: makeViewer({ relation: "withdrawn" }),
        }),
      ),
    ).toEqual([]);
    expect(getActiveFollowUpForms(makeAction({ followUpForms }))).toEqual([]);
  });
});
