import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import MultiSelectDropdown from "./MultiSelectDropdown";

const options = [
  { label: "New York", value: "ny" },
  { label: "New Jersey", value: "nj" },
  { label: "Côte d'Ivoire", value: "ci" },
  { label: "California", value: "ca" },
];

afterEach(cleanup);

const markdownOptions = [
  { label: "**Bold** choice", value: "b" },
  { label: "[Our site](https://example.org)", value: "s" },
];

function Field({
  options: fieldOptions = options,
  initial = [],
  searchable = false,
  maxSelections,
  disabled,
}: {
  options?: { label: string; value: string }[];
  initial?: string[];
  searchable?: boolean;
  maxSelections?: number;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <span id="places-label">Places</span>
          <MultiSelectDropdown
            options={fieldOptions}
            value={value}
            onChange={setValue}
            searchable={searchable}
            maxReached={
              maxSelections !== undefined && value.length >= maxSelections
            }
            labelId="places-label"
            disabled={disabled}
          />
          <output data-testid="answer">{value.join(",")}</output>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const trigger = () => screen.getByRole("combobox", { name: "Places" });
const answer = () => screen.getByTestId("answer").textContent;
const chips = () =>
  screen.queryByRole("list", { name: "Selected options" })
    ? within(screen.getByRole("list", { name: "Selected options" }))
        .getAllByRole("listitem")
        .map((node) => node.textContent)
    : [];
const optionNames = () =>
  screen.getAllByRole("option").map((node) => node.textContent);

function pick(name: string) {
  const option = screen.getByRole("option", { name });
  fireEvent.mouseMove(option);
  fireEvent.click(option);
}

async function open() {
  fireEvent.click(trigger());
  await screen.findByRole("listbox");
}

async function openSearch() {
  fireEvent.click(trigger());
  return screen.findByRole("combobox", { name: "Search options" });
}

describe.each([false, true])("searchable=%s", (searchable) => {
  it("toggles several options without closing and lists chips in option order", async () => {
    render(<Field searchable={searchable} />);
    expect(trigger().textContent).toContain("Select options…");
    expect(chips()).toEqual([]);
    await open();
    pick("California");
    pick("New York");
    await waitFor(() => expect(answer()).toBe("ca,ny"));
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(trigger().textContent).toContain("2 selected");
    expect(chips()).toEqual(["New York", "California"]);
    expect(
      screen
        .getByRole("option", { name: "New York" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    pick("New York");
    await waitFor(() => expect(answer()).toBe("ca"));
    expect(trigger().textContent).toContain("1 selected");
  });

  it("removes selections through chips", () => {
    render(<Field searchable={searchable} initial={["ny", "ca"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove New York" }));
    expect(answer()).toBe("ca");
    fireEvent.click(screen.getByRole("button", { name: "Remove California" }));
    expect(answer()).toBe("");
    expect(screen.queryByRole("list", { name: "Selected options" })).toBeNull();
    expect(trigger().textContent).toContain("Select options…");
  });

  it("disables unselected options at the limit and frees a slot on removal", async () => {
    render(
      <Field
        searchable={searchable}
        initial={["ny", "nj"]}
        maxSelections={2}
      />,
    );
    await open();
    const disabled = (name: string) =>
      screen.getByRole("option", { name }).getAttribute("aria-disabled");
    expect(disabled("California")).toBe("true");
    expect(disabled("New York")).not.toBe("true");
    pick("California");
    expect(answer()).toBe("ny,nj");
    pick("New York");
    await waitFor(() => expect(answer()).toBe("nj"));
    await waitFor(() => expect(disabled("California")).not.toBe("true"));
  });

  it("moves focus to the next chip, the previous chip, then the trigger on removal", () => {
    render(<Field searchable={searchable} initial={["ny", "nj", "ca"]} />);
    const remove = (name: string) =>
      screen.getByRole("button", { name: `Remove ${name}` });
    fireEvent.click(remove("New Jersey"));
    expect(document.activeElement === remove("California")).toBe(true);
    fireEvent.click(remove("California"));
    expect(document.activeElement === remove("New York")).toBe(true);
    fireEvent.click(remove("New York"));
    expect(answer()).toBe("");
    expect(document.activeElement === trigger()).toBe(true);
  });

  it("names chip removal by the rendered markdown label", () => {
    render(
      <Field
        searchable={searchable}
        options={markdownOptions}
        initial={["b", "s"]}
      />,
    );
    expect(chips()).toEqual(["Bold choice", "Our site"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Bold choice" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Our site" }));
    expect(answer()).toBe("");
  });

  it("shows read-only chips and cannot open when disabled", () => {
    render(<Field searchable={searchable} initial={["ca"]} disabled />);
    expect(chips()).toEqual(["California"]);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    fireEvent.click(trigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

it("toggles options from the keyboard in the plain dropdown", async () => {
  render(<Field />);
  trigger().focus();
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });
  await screen.findByRole("listbox");
  await waitFor(() =>
    expect(document.activeElement?.textContent).toBe("New York"),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Enter" });
  await waitFor(() => expect(answer()).toBe("ny"));
  expect(screen.getByRole("listbox")).toBeTruthy();
});

it("hides the search input unless searchable", async () => {
  render(<Field />);
  await open();
  expect(screen.queryByRole("combobox", { name: "Search options" })).toBeNull();
});

it("filters by trimmed, case- and accent-insensitive label substrings", async () => {
  render(<Field searchable />);
  const input = await openSearch();
  fireEvent.change(input, { target: { value: "  NEW  " } });
  await waitFor(() =>
    expect(optionNames()).toEqual(["New York", "New Jersey"]),
  );
  fireEvent.change(input, { target: { value: "cote" } });
  await waitFor(() => expect(optionNames()).toEqual(["Côte d'Ivoire"]));
  fireEvent.change(input, { target: { value: "zzzz" } });
  await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
  expect(screen.getByText("No matches")).toBeTruthy();
  expect(answer()).toBe("");
});

it("keeps the query while selecting, shows filtered-out chips, and resets on reopening", async () => {
  render(<Field searchable initial={["ca"]} />);
  let input = await openSearch();
  fireEvent.change(input, { target: { value: "new" } });
  await waitFor(() =>
    expect(optionNames()).toEqual(["New York", "New Jersey"]),
  );
  pick("New Jersey");
  await waitFor(() => expect(answer()).toBe("ca,nj"));
  expect((input as HTMLInputElement).value).toBe("new");
  expect(optionNames()).toEqual(["New York", "New Jersey"]);
  expect(chips()).toEqual(["New Jersey", "California"]);
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() =>
    expect(
      screen.queryByRole("combobox", { name: "Search options" }),
    ).toBeNull(),
  );
  expect(answer()).toBe("ca,nj");
  input = await openSearch();
  expect((input as HTMLInputElement).value).toBe("");
  await waitFor(() => expect(optionNames()).toHaveLength(4));
});

it("toggles options from the keyboard while searching", async () => {
  render(<Field searchable />);
  const input = await openSearch();
  fireEvent.change(input, { target: { value: "York" } });
  await waitFor(() => expect(optionNames()).toEqual(["New York"]));
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(answer()).toBe("ny"));
  expect((input as HTMLInputElement).value).toBe("York");
});

it("jumps to an option by the first letter of its rendered markdown label", async () => {
  render(<Field options={markdownOptions} />);
  await open();
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "O" });
  await waitFor(() =>
    expect(document.activeElement?.textContent).toBe("Our site"),
  );
});

it("searches markdown labels by their rendered text", async () => {
  render(<Field searchable options={markdownOptions} />);
  const input = await openSearch();
  fireEvent.change(input, { target: { value: "bold choice" } });
  await waitFor(() => expect(optionNames()).toEqual(["Bold choice"]));
  fireEvent.change(input, { target: { value: "example.org" } });
  await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
});

it("toggles the first match on Enter after typing a query", async () => {
  render(<Field searchable />);
  const input = await openSearch();
  fireEvent.input(input, {
    target: { value: "new" },
    inputType: "insertText",
  });
  await waitFor(() =>
    expect(optionNames()).toEqual(["New York", "New Jersey"]),
  );
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(answer()).toBe("ny"));
  expect(screen.getByRole("listbox")).toBeTruthy();
});

it("opens the search with a character typed on the closed trigger", async () => {
  render(<Field searchable />);
  trigger().focus();
  fireEvent.keyDown(trigger(), { key: "c" });
  const input = await screen.findByRole("combobox", {
    name: "Search options",
  });
  expect((input as HTMLInputElement).value).toBe("c");
  await waitFor(() =>
    expect(optionNames()).toEqual(["Côte d'Ivoire", "California"]),
  );
  await waitFor(() => expect(document.activeElement === input).toBe(true));
});
