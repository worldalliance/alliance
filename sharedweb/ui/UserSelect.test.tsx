import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import UserSelect from "./UserSelect";

afterEach(cleanup);

const renderFailed = () =>
  render(
    <UserSelect
      users={[]}
      selectedUserIds={[]}
      onChange={() => {}}
      loadFailed
    />,
  );

it("says the users failed to load before anything is typed", () => {
  renderFailed();

  expect(screen.getByText("Failed to load users.")).toBeTruthy();
});

it("says the users failed to load instead of that none match", () => {
  renderFailed();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ana" } });

  expect(screen.getByText("Failed to load users.")).toBeTruthy();
  expect(screen.queryByText("No users match that search.")).toBeNull();
});
