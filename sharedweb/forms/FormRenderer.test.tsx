import type { FormSchema } from "@alliance/common/forms/form-schema";
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
    expect(document.activeElement === screen.getByRole("textbox")).toBe(true);
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

const dropdownForm = (): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "location",
          type: "input",
          kind: "select",
          label: "Location",
          required: true,
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
  onSubmit = jest.fn(async () => false),
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
            fieldLabelRightContent={{
              location: <button type="button">Location help</button>,
            }}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

it.each([true, false])(
  "shows the required dropdown error with submit focus=%p",
  async (focused) => {
    const onSubmit = jest.fn(async () => false);
    renderDropdownForm(dropdownForm(), onSubmit);
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
    fireEvent.change(dropdown, { target: { value: "ny" } });
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

it.each([false, true])(
  "focuses an invalid dropdown before advancing, submitEvent=%p",
  async (submitEvent) => {
    const form = dropdownForm();
    form.pages.push({ id: "p2", fields: [] });
    const { container } = renderDropdownForm(form);
    await act(async () => {
      if (submitEvent) {
        const formElement = container.querySelector("form");
        if (!formElement) throw new Error("Form not rendered");
        fireEvent.submit(formElement);
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
  const form = dropdownForm();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={form}
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

it("reports a required dropdown before a later required native field", async () => {
  const form = dropdownForm();
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
});

it("keeps native checks the form does not duplicate", async () => {
  const form = dropdownForm();
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
    const form = dropdownForm();
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
