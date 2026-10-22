import type { CreateActionDto } from "@alliance/shared/client";
import { actionFieldDefs, type ActionFieldDef } from "./actionFieldDefs";

type FieldName = ActionFieldDef["name"];

const form: CreateActionDto = {
  name: "Call your rep",
  category: [],
  body: "",
  shortDescription: "",
  isContractSigningAction: false,
  visibilityMode: "all_members",
  onboarding: false,
  optional: false,
  preventCompletion: false,
  publicOnly: false,
  shouldCompleteAfterDeadline: false,
  isForumParticipationAction: false,
};

const shows = (f: CreateActionDto, names: FieldName[]) => {
  const shown = actionFieldDefs({ suites: [], loading: false, failed: false })
    .filter((def) => def.show?.(f) ?? true)
    .map((def) => def.name);
  return names.map((name) => shown.includes(name));
};

const customStatFields: FieldName[] = ["customStatGoal", "customStatLabel"];
const forumOverrideFields: FieldName[] = [
  "forumParticipationPostId",
  "forumParticipationIncludeChildren",
];

describe("actionFieldDefs", () => {
  it("shows the custom stat goal and label only once a stat type is picked", () => {
    expect(shows(form, customStatFields)).toEqual([false, false]);
    expect(
      shows({ ...form, customStatType: "none" }, customStatFields),
    ).toEqual([false, false]);
    expect(
      shows({ ...form, customStatType: "users_invited" }, customStatFields),
    ).toEqual([true, true]);
  });

  it("shows the forum post override only on forum participation actions", () => {
    expect(shows(form, forumOverrideFields)).toEqual([false, false]);
    expect(
      shows({ ...form, isForumParticipationAction: true }, forumOverrideFields),
    ).toEqual([true, true]);
  });

  it("notes on the suite field while suites load", () => {
    const suiteField = (loading: boolean) =>
      actionFieldDefs({ suites: [], loading, failed: false }).find(
        (def) => def.name === "suiteId",
      );

    expect(suiteField(true)?.helpText).toBe("Fetching suites...");
    expect(suiteField(false)?.helpText).toBeUndefined();
  });
});
