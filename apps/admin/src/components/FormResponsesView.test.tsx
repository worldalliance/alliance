import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import FormResponsesView from "./FormResponsesView";

afterEach(cleanup);

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [{ id: "home", type: "input", kind: "city", label: "Home" }],
    },
  ],
  outputViews: [],
};

const response: FormResponseDto = {
  id: 1,
  formId: 1,
  formSnapshotId: 7,
  createdAt: "2026-03-05T10:00:00.000Z",
  answers: { home: {} },
  publicAnswers: {},
  formulaChoices: {},
  schemaSnapshot: schema,
  phDistinctId: null,
  sid: null,
  visibilityValidatorResults: {},
};

it("lists no response to a question whose stored answer is an empty object", () => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <FormResponsesView
            title="Form"
            form={{ id: 1, title: "Form", formSnapshotId: 7, schema }}
            responses={[response]}
            loading={false}
            error={null}
            onRefresh={() => {}}
            withdrawnUserMap={new Map()}
            sidsToUserMap={{}}
            exportFileBase="form"
          />
        ),
      },
    ],
    { initialEntries: ["/?tab=questions"] },
  );
  render(<RouterProvider router={router} />);

  expect(screen.getByText("No users responded to this question.")).toBeTruthy();
});
