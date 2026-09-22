import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import SearchableSelect from "./SearchableSelect";

const options = [
  { label: "New York", value: "ny" },
  { label: "New Jersey", value: "nj" },
  { label: "California", value: "ca" },
];

afterEach(cleanup);

function Select() {
  const [value, setValue] = useState("ca");
  return (
    <>
      <span id="location-label">Location</span>
      <SearchableSelect
        options={options}
        value={value}
        onChange={setValue}
        labelId="location-label"
      />
      <output data-testid="answer">{value}</output>
    </>
  );
}

async function open() {
  fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
  return screen.findByRole("combobox", { name: "Search options" });
}

it("filters labels in order and commits option values only on selection", async () => {
  render(<Select />);
  const input = await open();
  fireEvent.change(input, { target: { value: "  NEW  " } });
  await waitFor(() =>
    expect(
      screen.getAllByRole("option").map((node) => node.textContent),
    ).toEqual(["New York", "New Jersey"]),
  );
  expect(screen.getByTestId("answer").textContent).toBe("ca");
  fireEvent.click(screen.getByRole("option", { name: "New Jersey" }));
  await waitFor(() =>
    expect(screen.getByTestId("answer").textContent).toBe("nj"),
  );
  expect(
    screen.getByRole("combobox", { name: "Location" }).textContent,
  ).toContain("New Jersey");
  await open();
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
});

it("keeps the selection for no matches and Escape, then supports keyboard selection", async () => {
  render(<Select />);
  let input = await open();
  fireEvent.change(input, { target: { value: "zzzz" } });
  await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
  expect(screen.getByText("No matches")).toBeTruthy();
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() =>
    expect(
      screen.queryByRole("combobox", { name: "Search options" }),
    ).toBeNull(),
  );
  expect(screen.getByTestId("answer").textContent).toBe("ca");
  input = await open();
  fireEvent.change(input, { target: { value: "York" } });
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() =>
    expect(screen.getByTestId("answer").textContent).toBe("ny"),
  );
});

it("cannot open when disabled", () => {
  render(<SearchableSelect options={options} disabled />);
  fireEvent.click(screen.getByRole("combobox", { name: "Options" }));
  expect(screen.queryByRole("combobox", { name: "Search options" })).toBeNull();
});

it("selects the first match on Enter after typing a query", async () => {
  render(<Select />);
  const input = await open();
  fireEvent.input(input, {
    target: { value: "new" },
    inputType: "insertText",
  });
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() =>
    expect(screen.getByTestId("answer").textContent).toBe("ny"),
  );
});

it("opens the search with a character typed on the closed trigger", async () => {
  render(<Select />);
  const trigger = screen.getByRole("combobox", { name: "Location" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "j" });
  const input = await screen.findByRole("combobox", {
    name: "Search options",
  });
  expect((input as HTMLInputElement).value).toBe("j");
  await waitFor(() =>
    expect(
      screen.getAllByRole("option").map((node) => node.textContent),
    ).toEqual(["New Jersey"]),
  );
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() =>
    expect(screen.getByTestId("answer").textContent).toBe("nj"),
  );
});

it("leaves Space and modifier shortcuts on the closed trigger out of the search", async () => {
  render(<Select />);
  const trigger = screen.getByRole("combobox", { name: "Location" });
  trigger.focus();
  for (const init of [
    { key: " " },
    { key: "Tab" },
    { key: "c", metaKey: true },
    { key: "c", ctrlKey: true },
    { key: "c", altKey: true },
  ])
    fireEvent.keyDown(trigger, init);
  expect(screen.queryByRole("combobox", { name: "Search options" })).toBeNull();
  const input = await open();
  expect((input as HTMLInputElement).value).toBe("");
});
