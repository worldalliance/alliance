import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import { createRef } from "react";
import FilterBar, {
  FilterKind,
  type FilterBarHandle,
  type FilterDefinition,
} from "./FilterBar";

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
  query?: string;
}) => {
  const filters: FilterDefinition[] = [
    {
      kind: FilterKind.Options,
      key: "kind",
      label: "Kind",
      options: OPTIONS,
      selected: new Set(params.selected),
      defaultSelected: new Set(["a"]),
      onChange: params.onOptions ?? mock(),
    },
    {
      kind: FilterKind.Toggle,
      key: "old",
      label: "Include old",
      checked: params.checked,
      defaultChecked: false,
      onChange: params.onToggle ?? mock(),
    },
  ];
  render(
    <FilterBar
      search={{
        label: "Search things",
        value: params.query ?? "",
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
          defaultChecked: false,
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

it("focuses a chip that appears when its filter turns on, and throws once it's gone", () => {
  const ref = createRef<FilterBarHandle>();
  const bar = (checked: boolean) => (
    <FilterBar
      ref={ref}
      search={{ label: "Search things", value: "", onChange: mock() }}
      filters={[
        {
          kind: FilterKind.Toggle,
          key: "old",
          label: "Include old",
          checked,
          defaultChecked: false,
          onChange: mock(),
        },
      ]}
    />
  );
  const { rerender } = render(bar(false));
  expect(() => ref.current?.focusChip("old")).toThrow();
  rerender(bar(true));
  act(() => ref.current?.focusChip("old"));
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Remove filter: Include old" }),
  );
  rerender(bar(false));
  expect(() => ref.current?.focusChip("old")).toThrow();
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

it("offers Clear all only while something differs from the defaults", () => {
  renderBar({ selected: ["a"], checked: false });
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
});

it("returns the search and every changed filter to its default on Clear all", () => {
  const onOptions = mock();
  const onToggle = mock();
  const onSearch = mock();
  renderBar({
    selected: ["b"],
    checked: true,
    query: "rally",
    onOptions,
    onToggle,
    onSearch,
  });
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(onSearch).toHaveBeenCalledWith("");
  expect(onOptions).toHaveBeenCalledWith(new Set(["a"]));
  expect(onToggle).toHaveBeenCalledWith(false);
  expect(document.activeElement).toBe(
    screen.getByRole("searchbox", { name: "Search things" }),
  );
});

it("leaves filters already at their default alone on Clear all", () => {
  const onOptions = mock();
  const onToggle = mock();
  renderBar({ selected: ["a"], checked: true, onOptions, onToggle });
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(onToggle).toHaveBeenCalledWith(false);
  expect(onOptions).not.toHaveBeenCalled();
});

it("offers Clear all only while a chip or the search shows", () => {
  renderBar({ selected: ["a", "b"], checked: false });
  expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  cleanup();
  renderBar({ selected: ["a"], checked: true });
  expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
});

it("empties the typed search on Clear all, even with the box focused", () => {
  render(searchBar("rally"));
  const box = screen.getByRole<HTMLInputElement>("searchbox");
  box.focus();
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(box.value).toBe("");
});

it("clears a typed search the page hasn't caught up with", () => {
  const onSearch = mock();
  const { rerender } = render(searchBar("", onSearch));
  const box = screen.getByRole<HTMLInputElement>("searchbox");
  fireEvent.change(box, { target: { value: "x" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(onSearch).toHaveBeenLastCalledWith("");
  rerender(searchBar("x", onSearch));
  rerender(searchBar("", onSearch));
  expect(box.value).toBe("");
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
});

it("shows a value Back restores after Clear all on an already empty search", () => {
  const { rerender } = render(searchBar(""));
  const box = screen.getByRole<HTMLInputElement>("searchbox");
  fireEvent.change(box, { target: { value: "x" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  rerender(searchBar("x"));
  expect(box.value).toBe("x");
});

it("offers Clear all for an empty selection", () => {
  renderBar({ selected: [], checked: false });
  expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
});
