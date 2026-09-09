import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import {
  __resetAnalyticsForTests,
  registerAnalytics,
  type AnalyticsBackend,
} from "@alliance/shared/lib/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { imageSrcFromKey } from "../lib/imageSrc";
import FormRenderer, { computeFormStorageKey } from "./FormRenderer";

let captured: string[] = [];

const recordingBackend: AnalyticsBackend = {
  capture: (event) => {
    captured.push(event);
  },
  captureException: () => {},
};

beforeEach(() => {
  window.localStorage.clear();
  captured = [];
  registerAnalytics(recordingBackend);
});
afterEach(() => {
  cleanup();
  __resetAnalyticsForTests();
});

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        {
          id: "agree",
          type: "input",
          kind: "checkbox",
          label: "Agree",
          required: true,
        },
      ],
    },
  ],
  outputViews: [],
};

const draftKey = computeFormStorageKey({ formId: 1, instanceId: "7" });

function form(props: {
  previewMode?: boolean;
  submitted?: unknown[];
  starts?: string[];
  draftFormResponse?: FormResponseDto;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <FormRenderer
          form={schema}
          id={1}
          formSnapshotId={1}
          actionId={1}
          persistKey="7"
          onSubmit={async (data) => {
            props.submitted?.push(data);
            return true;
          }}
          onAbandonAction={() => {}}
          onFormStarted={() => props.starts?.push("started")}
          draftFormResponse={props.draftFormResponse}
          previewMode={props.previewMode}
        />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function renderForm(
  previewMode?: boolean,
  draftFormResponse?: FormResponseDto,
) {
  const submitted: unknown[] = [];
  const starts: string[] = [];
  const view = render(
    form({ previewMode, submitted, starts, draftFormResponse }),
  );
  return {
    submitted,
    starts,
    goLive: () =>
      view.rerender(
        form({ previewMode: false, submitted, starts, draftFormResponse }),
      ),
  };
}

function formElement() {
  const form = screen.getByRole("textbox").closest("form");
  if (!form) throw new Error("the renderer put no form around its fields");
  return form;
}

const serverDraft = (answers: Record<string, unknown>): FormResponseDto => ({
  id: 1,
  formId: 1,
  formSnapshotId: 1,
  answers,
  publicAnswers: {},
  schemaSnapshot: {},
  visibilityValidatorResults: {},
  createdAt: new Date().toISOString(),
});

const buttonLabels = () =>
  screen.getAllByRole("button").map((button) => button.textContent);

describe("a previewed form", () => {
  it("takes an answer, validates, and submits nothing", async () => {
    const { submitted } = renderForm(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Ada" },
    });
    expect(screen.getByDisplayValue("Ada")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));

    await waitFor(() =>
      expect(screen.getByText("This field is required.")).toBeDefined(),
    );
    expect(submitted).toEqual([]);
  });

  it("submits nothing when the form itself is submitted", async () => {
    const { submitted } = renderForm(true);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(formElement());

    await act(async () => {});
    expect(submitted).toEqual([]);
  });

  it("offers no way to withdraw, which would record the viewer", () => {
    renderForm(true);

    expect(buttonLabels()).toEqual(["Complete (Preview Mode)"]);
  });

  it("counts as no page of a form anybody filled in", async () => {
    renderForm(true);

    await act(async () => {});
    expect(captured).toEqual([]);
  });

  it("starts no form either, however much gets typed into it", async () => {
    const { starts } = renderForm(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Ada" },
    });

    await act(async () => {});
    expect(starts).toEqual([]);
    expect(captured).toEqual([]);
  });

  it("keeps no draft, so nothing it holds reaches the live form", async () => {
    renderForm(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Ada" },
    });

    await act(async () => {});
    expect(Object.keys(window.localStorage)).toEqual([]);
  });

  it("leaves the draft the live form owns where it is", async () => {
    window.localStorage.setItem(
      draftKey,
      JSON.stringify({ formData: { name: "Kept" }, currentPageIndex: 0 }),
    );
    const preview = renderForm(true);

    expect(screen.queryByDisplayValue("Kept")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Typed while previewing" },
    });
    await act(async () => {});

    preview.goLive();
    await act(async () => {});
    expect(screen.getByDisplayValue("Kept")).toBeDefined();
    expect(
      JSON.parse(window.localStorage.getItem(draftKey) ?? "{}").formData,
    ).toEqual({ name: "Kept" });
  });

  it("hands the live form none of what it typed, with no draft stored", async () => {
    const preview = renderForm(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Typed while previewing" },
    });
    await act(async () => {});

    preview.goLive();
    await act(async () => {});
    expect(screen.queryByDisplayValue("Typed while previewing")).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem(draftKey) ?? "{}").formData,
    ).toEqual({});
  });

  it("reads none of the draft the server holds, and hands it to the live form", async () => {
    const preview = renderForm(true, serverDraft({ name: "From the server" }));

    await act(async () => {});
    expect(screen.queryByDisplayValue("From the server")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Typed while previewing" },
    });
    await act(async () => {});

    preview.goLive();
    await act(async () => {});
    expect(screen.getByDisplayValue("From the server")).toBeDefined();
  });

  it("hands the live form neither its errors nor its start", async () => {
    const preview = renderForm(true);

    fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
    await waitFor(() =>
      expect(screen.getByText("This field is required.")).toBeDefined(),
    );

    preview.goLive();
    await act(async () => {});
    expect(screen.queryByText("This field is required.")).toBeNull();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Ada" },
    });
    expect(preview.starts).toEqual(["started"]);
  });

  it("gives way to a response already given, subtree included", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const answers = { photo: "data:image/png;base64,iVBORw0KGgo=" };
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <FormRenderer
            form={{
              pages: [
                {
                  id: "page-1",
                  fields: [
                    {
                      id: "photo",
                      type: "input",
                      kind: "file",
                      label: "Photo",
                    },
                  ],
                },
              ],
              outputViews: [],
            }}
            id={1}
            formSnapshotId={1}
            actionId={1}
            onSubmit={null}
            previewMode
            renderFormAsCompleted
            completedFormResponse={serverDraft(answers)}
          />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Preview Mode/)).toBeNull();
    expect(screen.getByAltText("Uploaded file").getAttribute("src")).toBe(
      imageSrcFromKey(answers.photo),
    );
  });

  it("behaves as it always did when it isn't previewing", async () => {
    const { submitted, starts } = renderForm();

    await act(async () => {});
    expect(captured).toEqual(["form_page_viewed"]);
    expect(buttonLabels()).toContain("");

    fireEvent.click(screen.getByRole("checkbox"));
    expect(starts).toEqual(["started"]);
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));

    await waitFor(() => expect(submitted.length).toBe(1));
  });
});
