import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { LeafConditionEditor } from "./CohortLeafEditors";

serveApi(
  routes({
    "GET /tasks/listForms": () =>
      Response.json([{ id: 9, title: "Survey", displaySlug: "survey::v1" }]),
  }),
);

describe("LeafConditionEditor form picker", () => {
  it("labels forms by title and display slug", async () => {
    render(
      <LeafConditionEditor
        expr={{ type: "FormFieldValue", formId: 0, fieldId: "" }}
        onChange={() => {}}
        sources={{
          availableTags: [],
          tagsLoading: false,
          tagsError: false,
          availableActions: [],
          actionsLoading: false,
          actionsError: false,
          availableUsers: [],
          usersLoading: false,
          usersError: false,
        }}
      />,
      queryWrapper(),
    );

    expect(
      await screen.findByRole("option", { name: "Survey (survey::v1)" }),
    ).toBeTruthy();
  });
});
