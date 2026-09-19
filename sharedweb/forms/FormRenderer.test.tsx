import type {
  AnyField,
  FormSchema,
  TextField,
} from "@alliance/common/forms/form-schema";
import type { SubmitFormDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as uploadModule from "@alliance/shared/lib/uploadImageDataUri";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
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

const renderPreview = (
  schema: FormSchema,
  props: Partial<React.ComponentProps<typeof FormRenderer>> = {},
) =>
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
            {...props}
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
  it("won't draw a form whose variable fails", () => {
    renderPreview({
      ...form,
      variables: [{ name: "total", inputs: {}, formula: "this" }],
    });

    expect(screen.getByText("This form can't be displayed")).toBeTruthy();
    expect(
      screen.getByText("Refreshing the page may fix the issue."),
    ).toBeTruthy();
  });

  it("names the failing variable when asked to", () => {
    renderPreview(
      { ...form, variables: [{ name: "total", inputs: {}, formula: "this" }] },
      { showVariableError: true },
    );

    expect(screen.getByText('#{total}: "this" is not allowed.')).toBeTruthy();
  });

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
    expect(document.activeElement === screen.getByRole("textbox")).toBe(true);
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

const dropdownForm = ({
  searchable,
  label = "Location",
}: {
  searchable?: boolean;
  label?: string;
}): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "location",
          type: "input",
          kind: "select",
          label,
          required: true,
          searchable,
          options: [
            { label: "New York", value: "ny" },
            { label: "California", value: "ca" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
});

const renderDropdownForm = (
  form: FormSchema,
  onSubmit: (data: SubmitFormDto) => Promise<boolean> = jest.fn(
    async () => false,
  ),
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={form}
            id={1}
            formSnapshotId={1}
            actionId={1}
            onSubmit={onSubmit}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

it.each([undefined, false])(
  "keeps the native dropdown when search is %s",
  (searchable) => {
    renderPreview(dropdownForm({ searchable }));
    expect(screen.getByRole("combobox").tagName).toBe("SELECT");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ny" } });
    expect(
      screen.getByRole("option", { name: "New York", selected: true }),
    ).toBeTruthy();
  },
);

it("requires an option selection even after searching", async () => {
  renderPreview(dropdownForm({ searchable: true }));
  fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
  const input = await screen.findByRole("combobox", {
    name: "Search options",
  });
  fireEvent.change(input, { target: { value: "York" } });
  fireEvent.keyDown(input, { key: "Escape" });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
  });
  expect(await screen.findByText("This field is required.")).toBeTruthy();
  fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
  fireEvent.click(await screen.findByRole("option", { name: "New York" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
  });
  expect(screen.queryByText("This field is required.")).toBeNull();
});

it("names a searchable dropdown from its rendered Markdown label", () => {
  renderPreview(dropdownForm({ searchable: true, label: "**Location**" }));
  expect(screen.getByRole("combobox", { name: "Location" })).toBeTruthy();
});

it.each([
  { searchable: true, focused: true },
  { searchable: true, focused: false },
  { searchable: false, focused: true },
  { searchable: false, focused: false },
])(
  "shows the required error with searchable=$searchable and button focus=$focused",
  async ({ searchable, focused }) => {
    const onSubmit = jest.fn(async () => false);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SiteAppProvider>
            <FormRenderer
              form={dropdownForm({ searchable })}
              id={1}
              formSnapshotId={1}
              actionId={1}
              onSubmit={onSubmit}
              fieldLabelRightContent={{
                location: <button type="button">Location help</button>,
              }}
            />
          </SiteAppProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const submit = screen.getByRole("button", { name: "Complete" });
    await act(async () => {
      if (focused) submit.focus();
      submit.click();
    });
    expect(await screen.findByText("This field is required.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    const dropdown = screen.getByRole("combobox");
    expect(dropdown.getAttribute("aria-required")).toBe("true");
    expect(document.activeElement === dropdown).toBe(true);
    await act(async () => {
      submit.focus();
      submit.click();
    });
    expect(document.activeElement === dropdown).toBe(true);
    if (searchable) {
      fireEvent.click(dropdown);
      fireEvent.click(await screen.findByRole("option", { name: "New York" }));
    } else {
      fireEvent.change(dropdown, { target: { value: "ny" } });
    }
    await act(async () => {
      if (focused) submit.focus();
      submit.click();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ answers: { location: "ny" } }),
    );
  },
);

it.each([
  { searchable: false, submitEvent: false },
  { searchable: true, submitEvent: false },
  { searchable: false, submitEvent: true },
  { searchable: true, submitEvent: true },
])(
  "focuses an invalid dropdown before advancing, searchable=$searchable, submitEvent=$submitEvent",
  async ({ searchable, submitEvent }) => {
    const schema = dropdownForm({ searchable });
    schema.pages.push({ id: "p2", fields: [] });
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SiteAppProvider>
            <FormRenderer
              form={schema}
              id={1}
              formSnapshotId={1}
              actionId={1}
              onSubmit={jest.fn(async () => false)}
            />
          </SiteAppProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await act(async () => {
      if (submitEvent) {
        const form = container.querySelector("form");
        if (!form) throw new Error("Form not rendered");
        fireEvent.submit(form);
      } else {
        fireEvent.click(screen.getByRole("button", { name: /Next/ }));
      }
    });
    expect(document.activeElement === screen.getByRole("combobox")).toBe(true);
    expect(screen.getByText("This field is required.")).toBeTruthy();
  },
);

it("scrolls an invalid dropdown through the caller's container", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const scrollTo = jest.fn();
  container.scrollTo = scrollTo;
  const documentScroll = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={dropdownForm({})}
            id={1}
            formSnapshotId={1}
            actionId={1}
            onSubmit={jest.fn(async () => false)}
            scrollContainerRef={{ current: container }}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
    { container },
  );
  const dropdown = screen.getByRole("combobox");
  dropdown.closest<HTMLElement>(".scroll-mt-24")!.scrollIntoView =
    documentScroll;
  await act(async () => {
    screen.getByRole("button", { name: "Complete" }).click();
  });
  expect(scrollTo).toHaveBeenCalled();
  expect(documentScroll).not.toHaveBeenCalled();
  container.remove();
});

it.each([false, true])(
  "reports a required dropdown before a later required native field, searchable=%p",
  async (searchable) => {
    const form = dropdownForm({ searchable });
    form.pages[0].fields.push({
      id: "name",
      type: "input",
      kind: "text",
      label: "Name",
      required: true,
    });
    renderDropdownForm(form);
    await act(async () => {
      screen.getByRole("button", { name: "Complete" }).click();
    });
    expect(screen.getAllByText("This field is required.")).toHaveLength(2);
    expect(document.activeElement === screen.getByRole("combobox")).toBe(true);
  },
);

it("keeps native checks the form does not duplicate", async () => {
  const form = dropdownForm({});
  form.pages[0].fields.push({
    id: "email",
    type: "input",
    kind: "email",
    label: "Email",
  });
  const onSubmit = jest.fn(async () => false);
  renderDropdownForm(form, onSubmit);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "ny" } });
  const email = screen.getByRole("textbox");
  fireEvent.change(email, { target: { value: "not-an-email" } });
  await act(async () => {
    screen.getByRole("button", { name: "Complete" }).click();
  });
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(email, { target: { value: "person@example.com" } });
  await act(async () => {
    screen.getByRole("button", { name: "Complete" }).click();
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  "keeps native checks before advancing a page, submitEvent=%p",
  async (submitEvent) => {
    const form = dropdownForm({});
    form.pages[0].fields.push({
      id: "email",
      type: "input",
      kind: "email",
      label: "Email",
    });
    form.pages.push({
      id: "p2",
      fields: [{ id: "later", type: "input", kind: "text", label: "Later" }],
    });
    const { container } = renderDropdownForm(form);
    const advance = async () =>
      act(async () => {
        if (submitEvent) {
          const formElement = container.querySelector("form");
          if (!formElement) throw new Error("Form not rendered");
          fireEvent.submit(formElement);
        } else {
          fireEvent.click(screen.getByRole("button", { name: /Next/ }));
        }
      });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ny" } });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "not-an-email" },
    });
    await advance();
    expect(screen.queryByText("Later")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "person@example.com" },
    });
    await advance();
    expect(screen.getByText("Later")).toBeTruthy();
  },
);

it("focuses an earlier list answer before a later invalid field", async () => {
  renderDropdownForm({
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "people",
            type: "input",
            kind: "list",
            label: "People",
            defaultNumber: 1,
            fields: [
              {
                id: "who",
                type: "input",
                kind: "text",
                label: "Who",
                required: true,
              },
            ],
          },
          {
            id: "later",
            type: "input",
            kind: "text",
            label: "Later",
            required: true,
          },
        ],
      },
    ],
    outputViews: [],
  });
  await act(async () => {
    screen.getByRole("button", { name: "Complete" }).click();
  });
  const [who] = screen.getAllByRole("textbox");
  expect(document.activeElement === who).toBe(true);
});

const multiselectDropdownForm = (
  field: Partial<Extract<AnyField, { kind: "multiselect" }>>,
): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "places",
          type: "input",
          kind: "multiselect",
          label: "Places",
          required: true,
          dropdown: true,
          options: [
            { label: "New York", value: "ny" },
            { label: "California", value: "ca" },
            { label: "Texas", value: "tx" },
          ],
          ...field,
        },
      ],
    },
  ],
  outputViews: [],
});

const pickOption = async (name: string) => {
  const option = await screen.findByRole("option", { name });
  fireEvent.mouseMove(option);
  fireEvent.click(option);
};

it.each([false, true])(
  "requires a multiselect dropdown answer and submits option values, searchable=%p",
  async (searchable) => {
    const onSubmit = jest.fn(async (_data: SubmitFormDto) => false);
    renderDropdownForm(multiselectDropdownForm({ searchable }), onSubmit);
    const trigger = screen.getByRole("combobox", { name: "Places" });
    await act(async () => {
      screen.getByRole("button", { name: "Complete" }).click();
    });
    expect(screen.getByText("Select at least one option.")).toBeTruthy();
    expect(document.activeElement === trigger).toBe(true);
    fireEvent.click(trigger);
    await pickOption("Texas");
    await pickOption("New York");
    await act(async () => {
      screen.getByRole("button", { name: "Complete" }).click();
    });
    expect(screen.queryByText("Select at least one option.")).toBeNull();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].answers).toEqual({ places: ["tx", "ny"] });
  },
);

it("shows defaults as chips and keeps the selection-limit guidance", () => {
  renderPreview(
    multiselectDropdownForm({ defaultValue: ["ca"], maxSelections: 2 }),
  );
  expect(
    screen.getByRole("combobox", { name: "Places" }).textContent,
  ).toContain("1 selected");
  expect(
    screen.getByRole("button", { name: "Remove California" }),
  ).toBeTruthy();
  expect(screen.getByText("Select up to 2 options")).toBeTruthy();
});

it("orders chips by the randomized option order", async () => {
  const options = Array.from({ length: 8 }, (_, index) => ({
    label: `Option ${index + 1}`,
    value: `o${index + 1}`,
  }));
  renderPreview(
    multiselectDropdownForm({
      options,
      randomizeOptions: true,
      defaultValue: options.map((option) => option.value),
    }),
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Places" }));
  await screen.findByRole("listbox");
  const pickerOrder = screen
    .getAllByRole("option")
    .map((node) => node.textContent);
  const chipOrder = within(
    screen.getByRole("list", { name: "Selected options" }),
  )
    .getAllByRole("listitem")
    .map((node) => node.textContent);
  expect(pickerOrder).not.toEqual(options.map((option) => option.label));
  expect(chipOrder).toEqual(pickerOrder);
});
