import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useState } from "react";
import { Combobox, type ComboboxOption } from "./Combobox";
import { Field } from "./templates/Form";

afterEach(cleanup);

const tasks: ComboboxOption<number>[] = [
  { value: 1, label: "Call your senator", detail: "Climate" },
  { value: 2, label: "Sign the petition" },
  { value: 3, label: "Share the video" },
];

function TaskField(props: {
  onChange?: (value: number) => void;
  loading?: boolean;
  loadError?: string;
  initial?: number;
}) {
  const [value, setValue] = useState<number | null>(props.initial ?? null);
  return (
    <Field label="Task">
      {(control) => (
        <Combobox
          {...control}
          options={tasks}
          value={value}
          onChange={(next) => {
            setValue(next);
            props.onChange?.(next);
          }}
          loading={props.loading}
          loadError={props.loadError}
        />
      )}
    </Field>
  );
}

// The label's name is read before opening: an open list hides the rest of the page from the accessibility tree.
const input = () => screen.getByRole("combobox", { name: "Task" });
const type = (box: HTMLElement, text: string) => {
  fireEvent.keyDown(box, { key: "ArrowDown" });
  fireEvent.input(box, { target: { value: text } });
};

describe("Combobox", () => {
  it("filters by label and detail and picks the first match on Enter", async () => {
    const onChange = jest.fn();
    render(<TaskField onChange={onChange} />);
    const box = input();
    type(box, "climate");
    await waitFor(() =>
      expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Call your senatorClimate",
      ]),
    );
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(1);
    await waitFor(() =>
      expect((box as HTMLInputElement).value).toBe("Call your senator"),
    );
  });

  it("moves with the arrow keys and says when nothing matches", async () => {
    const onChange = jest.fn();
    render(<TaskField onChange={onChange} />);
    const box = input();
    type(box, "s");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBe(3));
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(2);
    type(box, "zzz");
    await waitFor(() => expect(screen.getByText("No matches")).toBeDefined());
  });

  it("says it is loading, or why it failed, in place of the list", async () => {
    render(<TaskField loadError="Couldn't load tasks" />);
    const box = input();
    type(box, "s");
    await waitFor(() =>
      expect(screen.getByText("Couldn't load tasks")).toBeDefined(),
    );
    expect(screen.queryAllByRole("option")).toEqual([]);
    expect(screen.queryByText("No matches")).toBeNull();
    cleanup();
    render(<TaskField loading />);
    type(input(), "s");
    await waitFor(() => expect(screen.getByText("Loading")).toBeDefined());
  });

  it("leaves filtering to the caller when it controls the query", async () => {
    const onQueryChange = jest.fn();
    render(
      <Combobox
        aria-label="Respondent"
        options={tasks}
        value={null}
        onChange={() => {}}
        query="zzz"
        onQueryChange={onQueryChange}
      />,
    );
    const box = screen.getByRole("combobox", { name: "Respondent" });
    type(box, "zzzz");
    expect(onQueryChange.mock.calls[0]?.[0]).toBe("zzzz");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBe(3));
  });

  it("keeps its pick on Escape with the list closed", async () => {
    render(<TaskField initial={2} />);
    const box = input();
    box.focus();
    await waitFor(() =>
      expect((box as HTMLInputElement).value).toBe("Sign the petition"),
    );
    fireEvent.keyDown(box, { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((box as HTMLInputElement).value).toBe("Sign the petition");
  });
});
