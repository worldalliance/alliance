import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "../ui/ToastProvider";
import FormResponsesView, { type FormWithSchema } from "./FormResponsesView";

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
  responses?: FormResponseDto[];
  form?: FormWithSchema | null;
  error?: string | null;
  refreshError?: Error;
}) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <FormResponsesView
            title="Form"
            form={
              params.form === undefined
                ? { id: 1, title: "Form", formSnapshotId: 7, schema }
                : params.form
            }
            responses={params.responses ?? [response]}
            loading={false}
            error={params.error ?? null}
            refresh={{
              mutate: () => {},
              isPending: false,
              isError: params.refreshError !== undefined,
              error: params.refreshError ?? null,
            }}
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
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return router;
};

it("opens on the responses table when no tab is picked", () => {
  renderView({ path: "/" });

  expect(screen.getByPlaceholderText("Search responses")).toBeTruthy();
});

it("shows only the load error when retrying a failed first load fails", () => {
  renderView({
    path: "/",
    responses: [],
    error: "Failed to load form responses",
    refreshError: new Error("offline"),
  });

  expect(screen.getByText("Couldn't load responses")).toBeTruthy();
  expect(screen.queryByText(/Couldn't refresh responses/)).toBeNull();
});

it("lists no response to a question whose stored answer is an empty object", () => {
  renderView({ path: "/?tab=questions" });

  expect(screen.getByText("No answers to this question")).toBeTruthy();
});

it("says the referrals failed to load beside the responses", () => {
  renderView({ path: "/?tab=questions", referralsError: "No share links" });

  expect(screen.getByText("No share links")).toBeTruthy();
  expect(screen.getByText(/^1 response ·/)).toBeTruthy();
});

it("shows the answers to the question picked", () => {
  renderView({ path: "/?tab=questions" });
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "note" },
  });

  expect(screen.getByText("Hello there")).toBeTruthy();
});

it("replays the respondent picked from the name search", async () => {
  renderView({
    path: "/?tab=replays",
    form: null,
    responses: [
      { ...response, id: 1, user: makeUser({ id: 1, name: "Ana" }) },
      { ...response, id: 2, user: makeUser({ id: 2, name: "Bea" }) },
    ],
  });
  const box = screen.getByRole("combobox", { name: "Find a respondent" });
  fireEvent.keyDown(box, { key: "ArrowDown" });
  fireEvent.input(box, { target: { value: "bea" } });
  fireEvent.click(await screen.findByRole("option", { name: /Bea/ }));

  expect(await screen.findByRole("heading", { name: "Bea" })).toBeTruthy();
  expect(screen.queryByText("Ana")).toBeNull();
});

it("opens the questions tab on the question it would show", () => {
  const router = renderView({ path: "/?tab=stats" });
  fireEvent.click(screen.getByText("Questions"));

  const params = new URLSearchParams(router.state.location.search);
  expect(params.get("tab")).toBe("questions");
  expect(params.get("questionField")).toBe("home");
});
