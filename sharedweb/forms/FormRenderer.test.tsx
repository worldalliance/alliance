import type {
  AnyField,
  FormSchema,
  TextField,
} from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as uploadModule from "@alliance/shared/lib/uploadImageDataUri";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import FormRenderer from "./FormRenderer";

afterEach(cleanup);

serveApi(routes({}));

const form: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "details",
          type: "input",
          kind: "text",
          label: "Details",
          required: true,
          visibleIfFormula: {
            conditions: {
              condition1: { kind: "equals", when: "joined", equals: "yes" },
            },
            formula: "condition1",
          },
        },
      ],
    },
    {
      id: "p2",
      fields: [
        {
          id: "joined",
          type: "input",
          kind: "radio",
          label: "Joined before?",
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

const renderPreview = (schema: FormSchema) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={schema}
            id={1}
            formSnapshotId={null}
            actionId={1}
            onSubmit={null}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const yesIn = (when: string) => ({
  conditions: { condition1: { kind: "equals" as const, when, equals: "yes" } },
  formula: "condition1",
});

const peopleForm = (
  noteConditions: Pick<TextField, "visibleIfFormula" | "requiredIfFormula">,
  ...topLevel: AnyField[]
): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        ...topLevel,
        {
          id: "people",
          type: "input",
          kind: "list",
          label: "People",
          defaultNumber: 2,
          fields: [
            { id: "gate", type: "input", kind: "text", label: "Gate" },
            {
              id: "note",
              type: "input",
              kind: "text",
              label: "Note",
              ...noteConditions,
            },
          ],
        },
      ],
    },
  ],
  outputViews: [],
});

const noteMarkedOptional = () =>
  screen
    .getAllByText("Note")
    .map(
      (note) =>
        note.closest("label")?.previousElementSibling?.textContent ===
        "Optional",
    );

describe("FormRenderer preview", () => {
  it("validates every page, going back to the first invalid one", async () => {
    renderPreview(form);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    });
    fireEvent.click(await screen.findByLabelText("Yes"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
    });

    expect(await screen.findByText(/Details/)).toBeTruthy();
    expect(screen.getByText(/This field is required/)).toBeTruthy();
  });

  it("marks a list sub-field required from its own row's cells", async () => {
    renderPreview(peopleForm({ requiredIfFormula: yesIn("gate") }));

    expect(noteMarkedOptional()).toEqual([true, true]);

    const [firstCardGate] = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(firstCardGate, { target: { value: "yes" } });
    });

    expect(noteMarkedOptional()).toEqual([false, true]);
  });

  it("draws a gated list sub-field only in the row that reveals it", async () => {
    renderPreview(peopleForm({ visibleIfFormula: yesIn("gate") }));

    expect(screen.queryByText("Note")).toBeNull();

    const [firstCardGate] = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(firstCardGate, { target: { value: "yes" } });
    });

    expect(screen.getAllByText("Note")).toHaveLength(1);
  });

  it("draws a list sub-field gated on a top-level answer in every row", async () => {
    renderPreview(
      peopleForm(
        { visibleIfFormula: yesIn("joined") },
        { id: "joined", type: "input", kind: "text", label: "Joined" },
      ),
    );

    expect(screen.queryByText("Note")).toBeNull();

    const [joined] = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(joined, { target: { value: "yes" } });
    });

    expect(screen.getAllByText("Note")).toHaveLength(2);
  });

  it("does not validate while a file is uploading", async () => {
    jest
      .spyOn(uploadModule, "uploadImageDataUri")
      .mockImplementation(() => new Promise(() => {}));
    const { container } = renderPreview({
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "photo",
              type: "input",
              kind: "file",
              label: "Photo",
              required: true,
            },
          ],
        },
      ],
      outputViews: [],
    });

    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("file input not rendered");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    await screen.findByText("Uploading...");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
    });

    expect(screen.queryByText("Please upload a file.")).toBeNull();
  });
});
