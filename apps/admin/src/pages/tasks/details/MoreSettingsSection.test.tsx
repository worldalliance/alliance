import type { CreateActionDto } from "@alliance/shared/client";
import { cleanup, screen } from "@testing-library/react";
import { renderForm } from "./renderDetailsForm";

const enabled = (form: Partial<CreateActionDto>, labels: RegExp[]) => {
  renderForm({ form });
  const result = labels.map(
    (label) => !screen.getByLabelText<HTMLInputElement>(label).disabled,
  );
  cleanup();
  return result;
};

const customStatFields = [/^Custom stat goal/, /^Custom stat label/];
const forumOverrideFields = [/^Forum post ID/, /^Include child replies/];

describe("MoreSettingsSection", () => {
  it("enables the custom stat goal and label only once a stat type is picked", () => {
    expect(enabled({ customStatType: undefined }, customStatFields)).toEqual([
      false,
      false,
    ]);
    expect(enabled({ customStatType: "none" }, customStatFields)).toEqual([
      false,
      false,
    ]);
    expect(
      enabled({ customStatType: "users_invited" }, customStatFields),
    ).toEqual([true, true]);
  });

  it("enables the forum post override only on forum participation tasks", () => {
    expect(enabled({}, forumOverrideFields)).toEqual([false, false]);
    expect(
      enabled({ isForumParticipationAction: true }, forumOverrideFields),
    ).toEqual([true, true]);
  });

  it("notes on the suite field while suites load", () => {
    renderForm({ lookups: { suitesLoading: true } });
    expect(screen.getByText("Loading suites…")).toBeTruthy();
    cleanup();
    renderForm();
    expect(screen.queryByText("Loading suites…")).toBeNull();
  });
});
