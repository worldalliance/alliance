import type { ActionSuiteDto } from "@alliance/shared/client";
import { screen } from "@testing-library/react";
import {
  fieldNames,
  options,
  renderForm,
} from "../lib/testing/renderActionForm";

describe("ActionForm suites", () => {
  it("offers the available suites and shows the stored one", () => {
    renderForm({
      form: { suiteId: 3 },
      props: {
        availableSuites: [
          {
            id: 3,
            name: "Climate",
            actions: [],
            events: [],
            reminderGroups: [],
            generalUpdates: [],
            isPartitioned: false,
          },
        ],
      },
    });

    expect(options("Suite")).toEqual([
      ["", "No suite"],
      ["3", "Climate"],
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>("Suite").value).toBe("3");
  });

  const partitionedSuite: ActionSuiteDto = {
    id: 3,
    name: "Climate",
    actions: [],
    events: [],
    reminderGroups: [],
    generalUpdates: [],
    isPartitioned: true,
  };

  it("leaves optional work, prerequisites and participants to the parts of a suite that uses them", () => {
    renderForm({
      form: { suiteId: 3, optional: false },
      props: {
        availableSuites: [partitionedSuite],
      },
    });

    expect(fieldNames("Completion")).not.toContain("optional");
    expect(screen.queryByRole("heading", { name: "Prerequisites" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Participating users" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Edit the suite's partition" })
        .getAttribute("href"),
    ).toBe("/suites/3");
  });

  it("shows no optional work, prerequisites or participants until the suites load", () => {
    renderForm({ form: { suiteId: 3 }, props: { suitesLoading: true } });

    expect(fieldNames("Completion")).not.toContain("optional");
    expect(screen.queryByRole("heading", { name: "Prerequisites" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Participating users" }),
    ).toBeNull();
    screen.getByText(/^Optional work, .* show once suites load\.$/);
  });

  it("shows no optional work, prerequisites or participants when the suites failed to load", () => {
    renderForm({ form: { suiteId: 3 }, props: { suitesError: true } });

    expect(fieldNames("Completion")).not.toContain("optional");
    expect(screen.queryByRole("heading", { name: "Prerequisites" })).toBeNull();
    expect(
      screen.getByText(/^Suites failed to load/).getAttribute("role"),
    ).toBe("alert");
  });

  it("shows optional work and prerequisites of an action with no suite while the suites load", () => {
    renderForm({ form: { suiteId: null }, props: { suitesLoading: true } });

    expect(fieldNames("Completion")).toContain("optional");
    expect(screen.getByRole("heading", { name: "Prerequisites" })).toBeTruthy();
  });

  it("keeps showing the prerequisites and participants an action brings into a partitioned suite", () => {
    renderForm({
      form: { suiteId: 3, optional: true, prerequisiteActionIds: [9] },
      props: {
        availableSuites: [partitionedSuite],
      },
    });

    expect(fieldNames("Completion")).not.toContain("optional");
    expect(screen.getByRole("heading", { name: "Prerequisites" })).toBeTruthy();
    screen.getByText(
      "Clear this action's prerequisites and participants below before saving.",
    );
  });

  it("keeps showing the participants an action brings into a partitioned suite, after they're cleared too", () => {
    const { rerender } = renderForm({
      form: { suiteId: 3 },
      props: {
        cohortExpression: { type: "Tag", tagId: "x" },
        availableSuites: [partitionedSuite],
      },
    });
    screen.getByText(/^Clear this action's prerequisites/);
    rerender({ cohortExpression: null });

    screen.getByRole("heading", { name: "Participating users" });
    expect(screen.queryByText(/^Clear this action's prerequisites/)).toBeNull();
  });
});
