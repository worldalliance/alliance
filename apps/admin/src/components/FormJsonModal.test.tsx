import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode, useState, type ReactElement } from "react";
import { JsonScopeKind } from "../lib/formJson";
import { FormJsonModal } from "./FormJsonModal";
import { CustomValidatorDraftsContext } from "./form-fields/customValidatorDrafts";

afterEach(cleanup);

// StrictMode, as the admin app runs in dev, mounts effects twice.
const renderIn = (element: ReactElement) =>
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>{element}</ToastProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [{ type: "input", kind: "text", id: "a", label: "A" }],
    },
  ],
  outputViews: [],
};

const drafts = {
  drafts: {},
  setDraft() {},
  removeDraft() {},
  createDraftId: () => -1,
};

function Harness({ onApply }: { onApply: (next: FormSchema) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <CustomValidatorDraftsContext.Provider value={drafts}>
      {open && (
        <FormJsonModal
          scope={{
            kind: JsonScopeKind.Element,
            pageIndex: 0,
            parentId: null,
            index: 0,
          }}
          schema={schema}
          displayOnly={false}
          onApply={onApply}
          onClose={() => setOpen(false)}
        />
      )}
    </CustomValidatorDraftsContext.Provider>
  );
}

const editJson = (value: unknown) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Element JSON" }), {
    target: { value: JSON.stringify(value) },
  });

const clickApply = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  });

describe("FormJsonModal", () => {
  let finishLookup: (found: boolean) => void = () => {};
  serveApi(
    routes({
      "GET /tasks/findOneCustomValidator/:id": ({ params }) =>
        new Promise<Response>((resolve) => {
          finishLookup = (found) =>
            resolve(
              found
                ? Response.json({ id: Number(params.id) })
                : new Response(null, { status: 500 }),
            );
        }),
    }),
  );

  it("shows why Apply is blocked", async () => {
    const applied: FormSchema[] = [];
    renderIn(<Harness onApply={(next) => applied.push(next)} />);

    editJson({ type: "input", kind: "text", id: "a", label: 1 });
    await clickApply();

    expect(screen.getByRole("alert").textContent).toContain(
      "label: Invalid input",
    );
    expect(applied).toEqual([]);
  });

  it("applies an id change only once confirmed", async () => {
    const applied: FormSchema[] = [];
    renderIn(<Harness onApply={(next) => applied.push(next)} />);
    const renamed = { type: "input", kind: "text", id: "b", label: "A" };

    editJson(renamed);
    await clickApply();
    expect(screen.getByRole("alert").textContent).toContain(
      'Id changes from "a" to "b"',
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(applied).toEqual([]);

    await clickApply();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply id and kind changes" }),
    );
    expect(applied.map((next) => next.pages[0].fields[0])).toEqual([renamed]);
  });

  it("drops an Apply the admin cancelled during a validator lookup", async () => {
    const applied: FormSchema[] = [];
    renderIn(<Harness onApply={(next) => applied.push(next)} />);

    editJson({
      type: "input",
      kind: "text",
      id: "a",
      label: "A",
      customValidatorId: 7,
    });
    await clickApply();
    expect(screen.getByRole("button", { name: "Checking..." })).toBeTruthy();
    expect(
      screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Element JSON" })
        .readOnly,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => finishLookup(true));

    expect(applied).toEqual([]);
  });
});
