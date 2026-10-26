import type { DeleteUserAdminDto } from "@alliance/shared/client/types.gen";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteAccountModal } from "./DeleteAccountModal";

const renderModal = (
  deleteAccount: (body: DeleteUserAdminDto) => Promise<unknown>,
) => {
  const deleted: true[] = [];
  render(
    <DeleteAccountModal
      deleteAccount={deleteAccount}
      userName="Sam"
      userEmail="sam@example.com"
      onCancel={() => {}}
      onDeleted={() => deleted.push(true)}
    />,
  );
  fireEvent.change(screen.getByPlaceholderText(/Why is this account/), {
    target: { value: "  Asked by email  " },
  });
  fireEvent.change(screen.getByPlaceholderText("sam@example.com"), {
    target: { value: " SAM@example.com " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  return deleted;
};

it("deletes with the trimmed reason and confirmation, then reports it", async () => {
  const bodies: DeleteUserAdminDto[] = [];
  const deleted = renderModal(async (body) => bodies.push(body));

  await waitFor(() => expect(deleted).toEqual([true]));
  expect(bodies).toEqual([
    {
      reason: "Asked by email",
      confirmationEmail: "SAM@example.com",
      screenshotKey: null,
    },
  ]);
});

it("shows a refused deletion and lets the admin try again", async () => {
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});
  const refusal = new Error("You cannot delete your own account");
  const deleted = renderModal(() => Promise.reject(refusal));

  expect(
    await screen.findByText("You cannot delete your own account"),
  ).toBeTruthy();
  expect(deleted).toEqual([]);
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Delete account" })
      .disabled,
  ).toBe(false);
  expect(logged).toHaveBeenCalledWith("Failed to delete account", refusal);
  logged.mockRestore();
});
