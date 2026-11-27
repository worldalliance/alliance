import { cleanup, screen, within } from "@testing-library/react";
import { renderForm } from "./renderDetailsForm";

const rules = (name: string) => screen.getByRole("group", { name });

describe("TaskDetailsForm cohort", () => {
  it("says what an empty cohort means under each visibility", () => {
    renderForm({ form: { visibilityMode: "participating_groups" } });
    within(rules("Participating members")).getByText(
      "No conditions, so no members match, and nobody sees it once launched.",
    );

    cleanup();
    renderForm({ form: { visibilityMode: "all_members" } });
    within(rules("Participating members")).getByText(
      "No conditions, so no members are assigned. Once launched, every member still sees it.",
    );
  });

  it("says a public-only task's page still opens with an empty cohort", () => {
    renderForm({
      form: { visibilityMode: "participating_groups", publicOnly: true },
    });
    within(rules("Participating members")).getByText(
      "No conditions, so no members are assigned. Its page still opens to anyone with the link.",
    );
  });

  it("says the stored cohort couldn't be read instead of calling it empty", () => {
    renderForm({
      form: { visibilityMode: "participating_groups" },
      cohortParseFailed: true,
    });
    const builder = rules("Participating members");
    within(builder).getByText(/^The stored cohort couldn.t be read, so its/);
    expect(within(builder).queryByText(/^No conditions/)).toBeNull();
  });

  it("says when the prerequisite tasks failed to load", () => {
    renderForm({ lookups: { allActionsLoadFailed: true } });
    within(rules("Prerequisites")).getByRole("option", {
      name: "Couldn't load tasks",
    });
  });
});
