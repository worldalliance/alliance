import {
  anyFieldSchema,
  type MultiSelectField,
} from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";
import { EditableChoiceField } from "./EditableChoiceField";

afterEach(cleanup);
serveApi(routes({}));

const initial: MultiSelectField = {
  id: "places",
  type: "input",
  kind: "multiselect",
  label: "Places",
  required: true,
  randomizeOptions: true,
  maxSelections: 2,
  defaultValue: ["ny"],
  options: [
    { label: "New York", value: "ny" },
    { label: "California", value: "ca" },
  ],
};

let latest: MultiSelectField = initial;

function Editor({ start = initial }: { start?: MultiSelectField }) {
  const [field, setField] = useState(start);
  latest = field;
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <CustomValidatorDraftsContext.Provider
            value={{
              drafts: {},
              setDraft() {},
              removeDraft() {},
              createDraftId: () => -1,
            }}
          >
            <EditableChoiceField
              field={field}
              onUpdate={(updates) =>
                setField((prev) => ({
                  ...prev,
                  ...updates,
                  kind: "multiselect",
                }))
              }
              onRemove={() => {}}
            />
          </CustomValidatorDraftsContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const display = () => screen.getByRole("combobox", { name: "Display" });
const reloaded = () => {
  const field = anyFieldSchema.parse(JSON.parse(JSON.stringify(latest)));
  if (field.kind !== "multiselect") throw new Error(`kind: ${field.kind}`);
  return field;
};

it("defaults to checkboxes and sets both flags for each display", () => {
  render(<Editor />);
  expect((display() as HTMLSelectElement).value).toBe("checkboxes");

  fireEvent.change(display(), { target: { value: "dropdown" } });
  expect(reloaded()).toMatchObject({ dropdown: true });
  expect(reloaded()).not.toHaveProperty("searchable");

  fireEvent.change(display(), { target: { value: "searchable-dropdown" } });
  expect(reloaded()).toMatchObject({ dropdown: true, searchable: true });

  fireEvent.change(display(), { target: { value: "checkboxes" } });
  expect(reloaded()).not.toHaveProperty("dropdown");
  expect(reloaded()).not.toHaveProperty("searchable");
});

it("keeps the field's other settings when switching displays", () => {
  render(<Editor />);
  fireEvent.change(display(), { target: { value: "searchable-dropdown" } });
  fireEvent.change(display(), { target: { value: "dropdown" } });
  const { dropdown: _dropdown, ...rest } = reloaded();
  expect(rest).toEqual(initial);
  expect((display() as HTMLSelectElement).value).toBe("dropdown");
});

describe("categories", () => {
  const categorized: MultiSelectField = {
    ...initial,
    options: [
      { label: "New York", value: "ny" },
      { label: "California", value: "ca" },
      { label: "Oregon", value: "or" },
      { label: "Texas", value: "tx" },
    ],
  };
  const categoryNames = () =>
    screen
      .getAllByRole("textbox", { name: "Category name" })
      .map((input) => (input as HTMLInputElement).value);
  const assign = (value: string, name: string) => {
    const select = within(
      screen.getByDisplayValue(value).parentElement!,
    ).getByRole("combobox", { name: "Category" }) as HTMLSelectElement;
    const option = within(select).getByRole("option", { name });
    fireEvent.change(select, {
      target: { value: option.getAttribute("value") },
    });
  };
  const optionOrder = () => reloaded().options.map((option) => option.value);

  it("creates, renames, reorders, and deletes categories without touching answers", () => {
    render(<Editor start={categorized} />);
    expect(screen.queryByRole("combobox", { name: "Category" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    expect(categoryNames()).toEqual(["Category 1", "Category 2"]);
    const [first, second] = screen.getAllByRole("textbox", {
      name: "Category name",
    });
    fireEvent.change(first, { target: { value: "West" } });
    fireEvent.change(second, { target: { value: "South" } });

    assign("ca", "West");
    assign("tx", "South");
    assign("or", "West");
    expect(reloaded().options).toEqual([
      { label: "New York", value: "ny" },
      {
        label: "California",
        value: "ca",
        category: reloaded().categories![0].id,
      },
      { label: "Oregon", value: "or", category: reloaded().categories![0].id },
      { label: "Texas", value: "tx", category: reloaded().categories![1].id },
    ]);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Move category down" })[0],
    );
    expect(categoryNames()).toEqual(["South", "West"]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete category West, keeping its options",
      }),
    );
    expect(categoryNames()).toEqual(["South"]);
    const field = reloaded();
    expect(field.options.map((option) => option.category)).toEqual([
      undefined,
      undefined,
      undefined,
      field.categories![0].id,
    ]);
    expect(optionOrder()).toEqual(["ny", "ca", "or", "tx"]);
    expect(field.defaultValue).toEqual(["ny"]);
  });

  it("moves options only within their section", () => {
    render(<Editor start={categorized} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    assign("ca", "Category 1");
    assign("tx", "Category 1");

    const category1 = screen.getByRole("group", {
      name: "Options in Category 1",
    });
    expect(
      within(category1)
        .getAllByRole("button", { name: "Move option up" })
        .map((button) => (button as HTMLButtonElement).disabled),
    ).toEqual([true, false]);
    fireEvent.click(
      within(category1).getAllByRole("button", { name: "Move option up" })[1],
    );
    expect(optionOrder()).toEqual(["ny", "tx", "or", "ca"]);

    const uncategorized = screen.getByRole("group", {
      name: "Options without a category",
    });
    fireEvent.click(
      within(uncategorized).getAllByRole("button", {
        name: "Move option down",
      })[0],
    );
    expect(optionOrder()).toEqual(["or", "tx", "ny", "ca"]);
  });

  it("keeps focus on an option's category select as it changes section", () => {
    render(<Editor start={categorized} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    assign("ca", "Category 1");
    const select = within(
      screen.getByDisplayValue("ca").parentElement!,
    ).getByRole("combobox", { name: "Category" });
    expect(document.activeElement === select).toBe(true);
  });

  it("omits the uncategorized group once every option has a category", () => {
    render(<Editor start={categorized} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    for (const value of ["ny", "ca", "or", "tx"]) assign(value, "Category 1");
    expect(
      screen.queryByRole("group", { name: "Options without a category" }) ===
        null,
    ).toBe(true);
  });

  it("flags blank and duplicate names, which the schema rejects", () => {
    render(<Editor start={categorized} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    const [first, second] = screen.getAllByRole("textbox", {
      name: "Category name",
    });
    fireEvent.change(second, { target: { value: " category 1 " } });
    expect(second.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getByText(/Category names must be unique within the field/),
    ).toBeTruthy();
    fireEvent.change(first, { target: { value: "  " } });
    expect(screen.getByText(/Category names must not be blank/)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Delete category (unnamed), keeping its options",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Options in (unnamed)" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("option", { name: "(unnamed)" }).length,
    ).toBeGreaterThan(0);
    expect(anyFieldSchema.safeParse(latest).success).toBe(false);

    fireEvent.change(first, { target: { value: "East" } });
    expect(second.getAttribute("aria-invalid")).toBe("false");
    expect(anyFieldSchema.safeParse(latest).success).toBe(true);
  });

  it("lists an option naming a missing category as uncategorized until cleared", () => {
    render(
      <Editor
        start={{
          ...categorized,
          categories: [{ id: "east", name: "East" }],
          options: [
            { label: "New York", value: "ny", category: "east" },
            { label: "California", value: "ca", category: "deleted" },
          ],
        }}
      />,
    );
    const uncategorized = screen.getByRole("group", {
      name: "Options without a category",
    });
    expect(within(uncategorized).getByDisplayValue("ca")).toBeTruthy();
    const category = within(uncategorized).getByRole("combobox", {
      name: "Category",
    }) as HTMLSelectElement;
    expect(category.value).toBe("deleted");
    expect(
      within(category).getByRole("option", { name: "(missing category)" }),
    ).toHaveProperty("disabled", true);
    expect(anyFieldSchema.safeParse(latest).success).toBe(false);
    fireEvent.change(category, { target: { value: "" } });
    expect(latest.options?.[1]).not.toHaveProperty("category");
    expect(anyFieldSchema.safeParse(latest).success).toBe(true);
  });

  it("keeps categories when switching displays", () => {
    render(<Editor start={categorized} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }));
    assign("ny", "Category 1");
    const before = reloaded();
    fireEvent.change(display(), { target: { value: "searchable-dropdown" } });
    expect(reloaded()).toMatchObject({
      categories: before.categories,
      options: before.options,
    });
  });
});
