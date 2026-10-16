import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import FormResponsesView from "./FormResponsesView";

afterEach(cleanup);

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        { id: "home", type: "input", kind: "city", label: "Home" },
        { id: "note", type: "input", kind: "text", label: "Note" },
      ],
    },
  ],
  outputViews: [],
};

const response = makeFormResponse({
  formSnapshotId: 7,
  createdAt: "2026-03-05T10:00:00.000Z",
  answers: { home: {}, note: "Hello there" },
  schemaSnapshot: schema,
});

const renderView = (params: {
  path: string;
  referralsError?: string | null;
}) => {
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
            referralsError={params.referralsError}
            exportFileBase="form"
          />
        ),
      },
    ],
    { initialEntries: [params.path] },
  );
  render(<RouterProvider router={router} />);
};

it("lists no response to a question whose stored answer is an empty object", () => {
  renderView({ path: "/?tab=questions" });

  expect(screen.getByText("No users responded to this question.")).toBeTruthy();
});

it("says the referrals failed to load beside the responses", () => {
  renderView({ path: "/?tab=questions", referralsError: "No share links" });

  expect(screen.getByText("No share links")).toBeTruthy();
  expect(screen.getByText("1 response")).toBeTruthy();
});

it("shows the answers to the question picked", () => {
  renderView({ path: "/?tab=questions" });
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "note" },
  });

  expect(screen.getByText("Hello there")).toBeTruthy();
});
