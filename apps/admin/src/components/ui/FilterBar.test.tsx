import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import FilterBar, { FilterKind, type FilterDefinition } from "./FilterBar";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

const renderBar = (params: {
  selected: string[];
  checked: boolean;
  onOptions?: (selected: Set<string>) => void;
  onToggle?: (checked: boolean) => void;
  onSearch?: (value: string) => void;
}) => {
  const filters: FilterDefinition[] = [
    {
      kind: FilterKind.Options,
      key: "kind",
      label: "Kind",
      options: OPTIONS,
      selected: new Set(params.selected),
      onChange: params.onOptions ?? mock(),
    },
    {
      kind: FilterKind.Toggle,
      key: "old",
      label: "Include old",
      checked: params.checked,
      onChange: params.onToggle ?? mock(),
    },
  ];
  render(
    <FilterBar
      search={{
        label: "Search things",
        value: "",
        onChange: params.onSearch ?? mock(),
      }}
      filters={filters}
    />,
  );
};

it("shows no chips while nothing is filtered", () => {
  renderBar({ selected: ["a", "b"], checked: false });
  expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
});

it("shows a removable chip per active filter, counted on the Filters button", () => {
  const onOptions = mock();
  const onToggle = mock();
  renderBar({ selected: ["b"], checked: true, onOptions, onToggle });

  expect(screen.getByRole("button", { name: "Filters 2 active" })).toBeTruthy();
  const chips = screen.getByRole("list", { name: "Active filters" });
  expect(
    within(chips)
      .getAllByRole("listitem")
      .map((chip) => chip.textContent),
  ).toEqual(["Kind: Beta", "Include old"]);

  fireEvent.click(
    within(chips).getByRole("button", { name: "Remove filter: Kind: Beta" }),
  );
  expect(onOptions).toHaveBeenCalledWith(new Set(["a", "b"]));
  expect(document.activeElement).toBe(
    within(chips).getByRole("button", { name: "Remove filter: Include old" }),
  );

  fireEvent.click(
    within(chips).getByRole("button", { name: "Remove filter: Include old" }),
  );
  expect(onToggle).toHaveBeenCalledWith(false);
  expect(document.activeElement).toBe(
    within(chips).getByRole("button", { name: "Remove filter: Kind: Beta" }),
  );
});

it("moves focus to the Filters button when the last chip goes", () => {
  const { rerender } = render(<div />);
  const bar = (checked: boolean) => (
    <FilterBar
      search={{ label: "Search things", value: "", onChange: mock() }}
      filters={[
        {
          kind: FilterKind.Toggle,
          key: "old",
          label: "Include old",
          checked,
          onChange: () => rerender(bar(false)),
        },
      ]}
    />
  );
  rerender(bar(true));
  fireEvent.click(
    screen.getByRole("button", { name: "Remove filter: Include old" }),
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Filters" }),
  );
});

it("edits filters from the popover", async () => {
  const onOptions = mock();
  const onToggle = mock();
  renderBar({ selected: ["a", "b"], checked: false, onOptions, onToggle });

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  const kind = await screen.findByRole("group", { name: "Kind" });
  fireEvent.click(within(kind).getByRole("checkbox", { name: "Alpha" }));
  expect(onOptions).toHaveBeenCalledWith(new Set(["b"]));

  fireEvent.click(screen.getByRole("checkbox", { name: "Include old" }));
  expect(onToggle).toHaveBeenCalledWith(true);
});

it("reports what is typed in the search box", () => {
  const onSearch = mock();
  renderBar({ selected: ["a", "b"], checked: false, onSearch });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search things" }), {
    target: { value: "rally" },
  });
  expect(onSearch).toHaveBeenCalledWith("rally");
});

it("names an empty selection", () => {
  renderBar({ selected: [], checked: false });
  expect(screen.getByRole("list", { name: "Active filters" }).textContent).toBe(
    "Kind: none",
  );
});

it("shows a chip for a selection holding a value outside the options", () => {
  renderBar({ selected: ["a", "x"], checked: false });
  expect(screen.getByRole("list", { name: "Active filters" }).textContent).toBe(
    "Kind: Alpha",
  );
});

const searchBar = (value: string, onChange = mock()) => (
  <FilterBar
    search={{ label: "Search things", value, onChange }}
    filters={[]}
  />
);

it("keeps what is typed while the page's value lags behind", () => {
  render(searchBar(""));
  const box = screen.getByRole<HTMLInputElement>("searchbox");
  box.focus();
  fireEvent.change(box, { target: { value: "r" } });
  fireEvent.change(box, { target: { value: "ra" } });
  expect(box.value).toBe("ra");
});

it("shows a search changed elsewhere, such as by going back", () => {
  const { rerender } = render(searchBar("rally"));
  rerender(searchBar("march"));
  expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe("march");
});

it("shows a search changed elsewhere while the box has focus", () => {
  const { rerender } = render(searchBar(""));
  const box = screen.getByRole<HTMLInputElement>("searchbox");
  box.focus();
  fireEvent.change(box, { target: { value: "r" } });
  fireEvent.change(box, { target: { value: "ra" } });
  rerender(searchBar("r"));
  expect(box.value).toBe("ra");
  rerender(searchBar("ra"));
  rerender(searchBar(""));
  expect(box.value).toBe("");
});

it("shows a search Back restores after typing back to the page's value", () => {
  const { rerender } = render(searchBar(""));
  const box = screen.getByRole<HTMLInputElement>("searchbox");
  fireEvent.change(box, { target: { value: "a" } });
  fireEvent.change(box, { target: { value: "" } });
  rerender(searchBar(""));
  rerender(searchBar("a"));
  expect(box.value).toBe("a");
});

it("shows a search Back restores after the page skipped values the box sent", () => {
  const { rerender } = render(searchBar(""));
  const box = screen.getByRole<HTMLInputElement>("searchbox");
  fireEvent.change(box, { target: { value: "a" } });
  fireEvent.change(box, { target: { value: "ab" } });
  fireEvent.change(box, { target: { value: "a" } });
  rerender(searchBar("a"));
  rerender(searchBar("ab"));
  expect(box.value).toBe("ab");
});
