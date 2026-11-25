import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { CommandList } from "./CommandList";
import { optionMatches } from "./option";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

afterEach(cleanup);

const groups = [
  {
    label: "Questions",
    items: [
      { id: "text", label: "Short text", detail: "One line" },
      { id: "date", label: "Date" },
    ],
  },
  { label: "Blocks", items: [{ id: "heading", label: "Heading" }] },
];

const renderList = () => {
  const onPick = jest.fn();
  render(
    <CommandList label="Search elements" groups={groups} onPick={onPick} />,
  );
  return {
    onPick,
    input: screen.getByRole("combobox", { name: "Search elements" }),
  };
};

describe("CommandList", () => {
  it("picks the first item on Enter and the next one after an arrow", () => {
    const { onPick, input } = renderList();
    expect(screen.getByText("Questions")).toBeDefined();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenLastCalledWith("text");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenLastCalledWith("date");
  });

  it("filters by label and detail, and says when nothing matches", () => {
    const { onPick, input } = renderList();
    fireEvent.change(input, { target: { value: "one line" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Short textOne line",
    ]);
    expect(screen.queryByText("Blocks")).toBeNull();
    fireEvent.change(input, { target: { value: "head" } });
    fireEvent.click(screen.getByRole("option", { name: "Heading" }));
    expect(onPick).toHaveBeenLastCalledWith("heading");
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toEqual([]);
    expect(screen.getByText("No matches")).toBeDefined();
  });
});

it("closes its popover on Escape", async () => {
  render(
    <Popover>
      <PopoverTrigger>Add</PopoverTrigger>
      <PopoverContent className="p-0">
        <CommandList
          label="Search elements"
          groups={groups}
          onPick={() => {}}
        />
      </PopoverContent>
    </Popover>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  const input = await screen.findByRole("combobox", {
    name: "Search elements",
  });
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
});

describe("optionMatches", () => {
  it("ignores case and accents", () => {
    expect(optionMatches({ label: "Café" }, "CAFE")).toBe(true);
    expect(optionMatches({ label: "Date", detail: null }, "x")).toBe(false);
  });
});
