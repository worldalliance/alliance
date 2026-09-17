import type { AnyField } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { RenderField } from "./RenderField";

afterEach(cleanup);
serveApi(routes({}));

it.each([false, true])(
  "hides the dropdown label addon when hideLabel=%s",
  (hideLabel) => {
    render(
      <MemoryRouter>
        <SiteAppProvider>
          <RenderField
            fieldContext={staticFieldContext}
            field={{
              id: "location",
              type: "input",
              kind: "select",
              label: "**Location**",
              searchable: true,
              options: [{ label: "New York", value: "ny" }],
            }}
            hideLabel={hideLabel}
            labelRightAddon={<button type="button">Show publicly</button>}
          />
        </SiteAppProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("combobox", { name: "Location" })).toBeTruthy();
    expect(screen.queryByText("Show publicly") !== null).toBe(!hideLabel);
    expect(screen.queryByText("Optional") !== null).toBe(!hideLabel);
  },
);

const base = { id: "question", type: "input", label: "**Question**" } as const;
const options = [
  { label: "First choice", value: "first" },
  { label: "Second choice", value: "second" },
];
const singleInputs: AnyField[] = [
  { ...base, kind: "text" },
  { ...base, kind: "textarea" },
  { ...base, kind: "email" },
  { ...base, kind: "number" },
  { ...base, kind: "date" },
  { ...base, kind: "file" },
  { ...base, kind: "phone" },
  { ...base, kind: "time" },
  { ...base, kind: "timezone" },
  { ...base, kind: "city" },
  { ...base, kind: "select", options },
  { ...base, kind: "select", options, searchable: true },
  { ...base, kind: "multiselect", options, dropdown: true },
  { ...base, kind: "multiselect", options, dropdown: true, searchable: true },
];

describe.each([{ hideLabel: false }, { hideLabel: true }])(
  "hideLabel: $hideLabel",
  ({ hideLabel }) => {
    it.each(singleInputs)("names a $kind field from its question", (field) => {
      render(
        <MemoryRouter>
          <SiteAppProvider>
            <RenderField
              fieldContext={staticFieldContext}
              field={field}
              hideLabel={hideLabel}
            />
          </SiteAppProvider>
        </MemoryRouter>,
      );

      expect(screen.getByLabelText("Question")).toBeTruthy();
      if (hideLabel) expect(screen.queryByText("Optional")).toBeNull();
    });
  },
);

it.each([
  { kind: "radio", role: "radiogroup" },
  { kind: "multiselect", role: "group" },
] as const)(
  "names the $kind group without replacing option names",
  ({ kind, role }) => {
    render(
      <MemoryRouter>
        <SiteAppProvider>
          <RenderField
            fieldContext={staticFieldContext}
            field={{ ...base, kind, options }}
            hideLabel
          />
        </SiteAppProvider>
      </MemoryRouter>,
    );

    const group = screen.getByRole(role, {
      name: "Question",
    });
    for (const option of options) {
      expect(within(group).getByLabelText(option.label)).toBeTruthy();
    }
  },
);

it("names a range group while retaining the numeric option names", () => {
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <RenderField
          fieldContext={staticFieldContext}
          field={{ ...base, kind: "range", optionCount: 3 }}
        />
      </SiteAppProvider>
    </MemoryRouter>,
  );

  const group = screen.getByRole("radiogroup", { name: "Question" });
  expect(within(group).getByRole("radio", { name: "1" })).toBeTruthy();
  expect(within(group).getByRole("radio", { name: "3" })).toBeTruthy();
});

it("keeps question labels separate when a field is rendered twice", () => {
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <RenderField
          fieldContext={staticFieldContext}
          field={{ ...base, kind: "text", label: "First question" }}
        />
        <RenderField
          fieldContext={staticFieldContext}
          field={{ ...base, kind: "text", label: "Second question" }}
        />
      </SiteAppProvider>
    </MemoryRouter>,
  );

  const first = screen.getByRole("textbox", { name: "First question" });
  const second = screen.getByRole("textbox", { name: "Second question" });
  expect(first.getAttribute("aria-labelledby")).not.toBe(
    second.getAttribute("aria-labelledby"),
  );
});

const groupedInputs: AnyField[] = [
  { ...base, kind: "ranking", options },
  {
    ...base,
    kind: "list",
    fields: [{ ...base, id: "child", kind: "text", label: "Child question" }],
  },
];

it.each(groupedInputs)("names the $kind group", (field) => {
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <RenderField
          fieldContext={staticFieldContext}
          field={field}
          hideLabel
        />
      </SiteAppProvider>
    </MemoryRouter>,
  );
  expect(screen.getByRole("group", { name: "Question" })).toBeTruthy();
});

it("names the timezone button from its question and its selected zone", () => {
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <RenderField
          fieldContext={staticFieldContext}
          field={{ ...base, kind: "timezone" }}
          value="Asia/Kolkata"
        />
      </SiteAppProvider>
    </MemoryRouter>,
  );

  expect(
    screen.getByRole("button", { name: /^Question India Standard Time/ }),
  ).toBeTruthy();
});

describe("option categories", () => {
  const categorized = {
    ...base,
    categories: [
      { id: "fruit", name: "Fruit" },
      { id: "empty", name: "Empty" },
      { id: "veg", name: "Vegetables" },
    ],
    options: [
      { label: "Kale", value: "kale", category: "veg" },
      { label: "Apple", value: "apple", category: "fruit" },
      { label: "Other", value: "other" },
      { label: "Banana", value: "banana", category: "fruit" },
    ],
  };
  const renderField = (field: AnyField, value?: string[]) =>
    render(
      <MemoryRouter>
        <SiteAppProvider>
          <RenderField
            fieldContext={staticFieldContext}
            field={field}
            value={value}
            onChange={() => {}}
          />
        </SiteAppProvider>
      </MemoryRouter>,
    );

  it("groups a native select into optgroups after uncategorized options", () => {
    const { container } = renderField({ ...categorized, kind: "select" });
    const select = screen.getByRole("combobox", { name: "Question" });
    expect(
      Array.from(select.children).map((child) =>
        child.tagName === "OPTGROUP"
          ? [
              child.getAttribute("label"),
              Array.from(child.children).map((option) => option.textContent),
            ]
          : child.textContent,
      ),
    ).toEqual([
      "Select an option",
      "Other",
      ["Fruit", ["Apple", "Banana"]],
      ["Vegetables", ["Kale"]],
    ]);
    expect(container.querySelector("optgroup[label=Empty]")).toBeNull();
  });

  it("groups checkboxes under labelled headings, keeping the field-wide limit", () => {
    renderField({ ...categorized, kind: "multiselect", maxSelections: 1 }, [
      "kale",
    ]);
    const fruit = screen.getByRole("group", { name: "Fruit" });
    expect(
      within(fruit)
        .getAllByRole("checkbox")
        .map((box) => box.parentElement?.textContent),
    ).toEqual(["Apple", "Banana"]);
    const vegetables = screen.getByRole("group", { name: "Vegetables" });
    expect(
      within(vegetables).getByRole("checkbox", { name: "Kale" }),
    ).toHaveProperty("checked", true);
    expect(
      within(fruit).getByRole("checkbox", { name: "Apple" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("checkbox", { name: "Other" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.queryByText("Empty")).toBeNull();
  });

  it("marks only the first displayed checkbox of a required field required", () => {
    renderField({ ...categorized, kind: "multiselect", required: true });
    expect(
      screen
        .getAllByRole("checkbox")
        .filter((box) => box.hasAttribute("required"))
        .map((box) => box.parentElement?.textContent),
    ).toEqual(["Other"]);
  });

  it("randomizes options only within their categories", () => {
    const many = {
      ...categorized,
      kind: "multiselect" as const,
      randomizeOptions: true,
      options: Array.from({ length: 12 }, (_, index) => ({
        label: `Option ${index}`,
        value: `${index}`,
        category: index < 6 ? "fruit" : "veg",
      })),
    };
    renderField(many);
    const names = (group: string) =>
      within(screen.getByRole("group", { name: group }))
        .getAllByRole("checkbox")
        .map((box) => box.parentElement?.textContent);
    const fruit = names("Fruit");
    expect([...fruit].sort()).toEqual(
      [0, 1, 2, 3, 4, 5].map((index) => `Option ${index}`),
    );
    expect(fruit).not.toEqual([...fruit].sort());
    expect([...names("Vegetables")].sort()).toEqual(
      [6, 7, 8, 9, 10, 11].map((index) => `Option ${index}`).sort(),
    );
  });
});
