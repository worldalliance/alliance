import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import { UserPicker } from "./UserPicker";

it("lists, finds and stores a member with no name by id", async () => {
  const query = queryWrapper({ staleTime: Infinity });
  query.client.setQueryData(queryKeys.usersAdmin(), [
    { id: 41, name: "Ada", profilePicture: null, storedProfilePicture: null },
    { id: 42, name: null, profilePicture: null, storedProfilePicture: null },
  ]);
  const onChange = mock();
  render(<UserPicker label="Expert" selected={null} onChange={onChange} />, {
    wrapper: query.wrapper,
  });

  const box = screen.getByRole("combobox", { name: "Expert" });
  fireEvent.keyDown(box, { key: "ArrowDown" });
  fireEvent.change(box, { target: { value: "42" } });
  await waitFor(() =>
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["User #42"]),
  );
  fireEvent.keyDown(box, { key: "ArrowDown" });
  fireEvent.keyDown(box, { key: "Enter" });

  expect(onChange).toHaveBeenCalledWith({
    userId: 42,
    userName: "User #42",
    userProfilePicture: null,
  });
});
