import {
  isQuestionField,
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { useWebFormState } from "./useWebFormState";

const api = serveApi(routes({}));

const needed: AnyField = {
  id: "needed",
  type: "input",
  kind: "text",
  label: "Needed",
  required: true,
};
const schema: FormSchema = {
  pages: [
    { id: "p1", fields: [needed] },
    {
      id: "p2",
      fields: [{ id: "free", type: "input", kind: "text", label: "Free" }],
    },
  ],
  outputViews: [],
};

const answerable: FormSchema = { pages: [schema.pages[1]], outputViews: [] };

function renderFormState(
  form: FormSchema = schema,
  onSubmit = jest.fn(async () => true),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>{children}</SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useWebFormState({
        form,
        id: 1,
        formSnapshotId: 1,
        actionId: 1,
        initialPageIndex: 1,
        onSubmit,
      }),
    { wrapper },
  );
  return { hook, onSubmit };
}

it("names the first invalid page when a submit fails validation", async () => {
  const { hook, onSubmit } = renderFormState();

  let outcome;
  await act(async () => {
    outcome = await hook.result.current.submit();
  });

  expect(outcome).toEqual({ submitted: false, firstInvalidPageIndex: 0 });
  expect(onSubmit).not.toHaveBeenCalled();
});

it("reports a send the server accepts as submitted", async () => {
  const { hook, onSubmit } = renderFormState(answerable);

  let outcome;
  await act(async () => {
    outcome = await hook.result.current.submit();
  });

  expect(outcome).toEqual({ submitted: true, firstInvalidPageIndex: null });
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

it("reports a send that throws as not submitted", async () => {
  const { hook } = renderFormState(
    answerable,
    jest.fn(async () => {
      throw new Error("offline");
    }),
  );

  let outcome;
  await act(async () => {
    outcome = await hook.result.current.submit();
  });

  expect(outcome).toEqual({ submitted: false, firstInvalidPageIndex: null });
});

it("validates once when submitted again mid-check", async () => {
  let runs = 0;
  let release: () => void = () => {};
  api.alsoServing({
    "POST /tasks/runValidator/:id": async () => {
      runs += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return Response.json({ isValid: true });
    },
  });
  const { hook } = renderFormState({
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "code",
            type: "input",
            kind: "text",
            label: "Code",
            customValidatorId: 5,
          },
        ],
      },
      { id: "p2", fields: [] },
    ],
    outputViews: [],
  });

  let submits: Promise<unknown> = Promise.resolve();
  act(() => {
    submits = Promise.all([
      hook.result.current.submit(),
      hook.result.current.submit(),
    ]);
  });
  await waitFor(() => expect(runs).toBe(1));
  await act(async () => {
    release();
    await submits;
  });

  expect(runs).toBe(1);
});

it("fails a screen whose shown field is missing its answer", async () => {
  const { hook } = renderFormState();

  let valid;
  await act(async () => {
    valid = await hook.result.current.validateScreenFields([needed]);
  });

  expect(valid).toBe(false);
  expect(hook.result.current.fieldErrors.needed).toBeTruthy();
});

it("passes a screen whose fields need nothing", async () => {
  const { hook } = renderFormState();

  let valid;
  await act(async () => {
    valid = await hook.result.current.validateScreenFields(
      schema.pages[1].fields.filter(isQuestionField),
    );
  });

  expect(valid).toBe(true);
});
