import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import UserSelect from "./UserSelect";

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
