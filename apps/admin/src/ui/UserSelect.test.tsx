import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useState } from "react";
import { Field } from "./templates/Form";
import UserSelect from "./UserSelect";
import { pickUser } from "./UserSelect.testing";

afterEach(cleanup);

const USERS = [
  { id: 1, name: "Ada Lovelace", profilePicture: null },
  { id: 2, name: "Grace Hopper", profilePicture: null },
];

describe("UserSelect disabled", () => {
  it("disables the search and offers no matches", () => {
    render(
      <UserSelect
        users={USERS}
        selectedUserIds={[]}
        onChange={() => {}}
        label="Recipients"
        disabled
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>("Recipients").disabled).toBe(
      true,
    );
  });

  it("keeps the picks visible with their remove buttons inert", () => {
    const onChange = jest.fn();
    render(
      <UserSelect
        users={USERS}
        selectedUserIds={[1]}
        onChange={onChange}
        disabled
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    const remove = screen.getByRole<HTMLButtonElement>("button", {
      name: "Remove Ada Lovelace",
    });
    expect(remove.disabled).toBe(true);
    fireEvent.click(remove);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still removes a pick when enabled", () => {
    const onChange = jest.fn();
    render(
      <UserSelect users={USERS} selectedUserIds={[1, 2]} onChange={onChange} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Ada Lovelace" }),
    );
    expect(onChange).toHaveBeenCalledWith([2]);
  });
});

describe("UserSelect hint", () => {
  it("keeps the multi-pick's own hint by default", () => {
    render(
      <UserSelect users={USERS} selectedUserIds={[]} onChange={() => {}} />,
    );
    expect(screen.getByText("Selected users will appear here.")).toBeTruthy();
  });

  it("shows no hint for a single pick unless given one", () => {
    const { rerender } = render(
      <UserSelect
        users={USERS}
        selectedUserIds={[]}
        onChange={() => {}}
        single
      />,
    );
    expect(screen.queryByText("Selected users will appear here.")).toBeNull();
    rerender(
      <UserSelect
        users={USERS}
        selectedUserIds={[]}
        onChange={() => {}}
        single
        hint="No one is picked: the preview uses your own account."
      />,
    );
    expect(
      screen.getByText("No one is picked: the preview uses your own account."),
    ).toBeTruthy();
  });

  it("hides the hint once someone is picked", () => {
    render(
      <UserSelect
        users={USERS}
        selectedUserIds={[1]}
        onChange={() => {}}
        hint="No one yet"
      />,
    );
    expect(screen.queryByText("No one yet")).toBeNull();
  });
});

function Picker(props: { single?: boolean; error?: string }) {
  const [ids, setIds] = useState<number[]>([]);
  return (
    <Field label="Member" error={props.error}>
      {(control) => (
        <UserSelect
          {...control}
          label={null}
          users={USERS}
          selectedUserIds={ids}
          onChange={setIds}
          single={props.single}
        />
      )}
    </Field>
  );
}

describe("UserSelect in Field", () => {
  it("takes its name and error from Field", () => {
    render(<Picker error="Pick someone." />);
    const box = screen.getByRole("combobox", { name: "Member" });
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Pick someone.");
  });

  it("picks with the arrow keys and Enter", async () => {
    render(<Picker />);
    const box = screen.getByRole("combobox", { name: "Member" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBe(2));
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove Grace Hopper" })),
    );
  });

  it("finds a member by id as well as by name", async () => {
    render(<Picker />);
    const box = screen.getByRole("combobox", { name: "Member" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.change(box, { target: { value: "2" } });
    await waitFor(() =>
      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Grace Hopper"]),
    );
  });

  it("moves focus to the picked row's Remove after a single pick", async () => {
    render(<Picker single />);
    const box = screen.getByRole("combobox", { name: "Member" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.input(box, { target: { value: "ada" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBe(1));
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Remove Ada Lovelace" }),
      ),
    );
  });

  it("leaves no gap when nothing is picked and there is no hint", () => {
    const { container } = render(
      <UserSelect
        users={USERS}
        selectedUserIds={[]}
        onChange={() => {}}
        single
      />,
    );
    expect(container.querySelector(".grid")).toBeNull();
  });
});

describe("UserSelect focus after a filtered remove", () => {
  function Picks() {
    const [ids, setIds] = useState<number[]>([1, 2]);
    return (
      <UserSelect
        users={[...USERS, { id: 3, name: "Alan Turing", profilePicture: null }]}
        selectedUserIds={ids}
        onChange={setIds}
      />
    );
  }

  it("takes the neighbour from the picks shown, not the ones filtered out", async () => {
    render(<Picks />);
    const search = screen.getByLabelText("Recipients");
    fireEvent.click(screen.getByRole("button", { name: "Filter (2)" }));
    fireEvent.change(screen.getByPlaceholderText("Filter selected users..."), {
      target: { value: "ada" },
    });
    const remove = screen.getByRole("button", { name: "Remove Ada Lovelace" });
    remove.focus();
    fireEvent.click(remove);
    await waitFor(() => expect(document.activeElement).toBe(search));

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    search.focus();
    await pickUser(search, { query: "alan", name: "Alan Turing" });
    await screen.findByRole("button", { name: "Remove Alan Turing" });
    expect(document.activeElement).toBe(search);
  });
});

describe("UserSelect with nothing left to pick", () => {
  it("says so rather than blaming a search nobody typed", async () => {
    render(
      <UserSelect users={USERS} selectedUserIds={[1, 2]} onChange={() => {}} />,
    );
    fireEvent.keyDown(screen.getByLabelText("Recipients"), {
      key: "ArrowDown",
    });
    expect(await screen.findByText("No users to pick.")).toBeTruthy();
  });
});

describe("UserSelect filter caption", () => {
  const picked = (label: string | null) =>
    render(
      <UserSelect
        users={USERS}
        selectedUserIds={[1, 2]}
        onChange={() => {}}
        label={label}
      />,
    );

  it("counts the picks when it labels itself", () => {
    picked("Recipients");
    expect(screen.getByRole("button", { name: "Filter (2)" })).toBeTruthy();
  });

  it("doesn't repeat a Field's count under it", () => {
    picked(null);
    expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
    expect(screen.queryByText("Filter (2)")).toBeNull();
  });
});
