import type { DeleteUserAdminDto } from "@alliance/shared/client/types.gen";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sessionExpiredMessage } from "../lib/sessionExpired";
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
  const refusal = {
    message: "You cannot delete your own account",
    statusCode: 400,
  };
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

let uploadRefusal: { status: number; message: string };
beforeEach(() => {
  uploadRefusal = { status: 400, message: "Image is too large" };
});

serveApi(
  routes({
    "POST /images/uploadImage": () =>
      Response.json({ message: uploadRefusal.message }, uploadRefusal),
  }),
);

it("says why a screenshot upload was refused", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const { baseElement } = render(
    <DeleteAccountModal
      deleteAccount={() => Promise.reject(new Error("not called"))}
      userName="Test Member"
      userEmail="member@example.com"
      onCancel={() => {}}
      onDeleted={() => {}}
    />,
  );
  const input = baseElement.querySelector('input[type="file"]');
  if (!input) throw new Error("no file input");
  fireEvent.change(input, {
    target: { files: [new File(["x"], "shot.png", { type: "image/png" })] },
  });

  expect(await screen.findByText("Image is too large")).toBeTruthy();
  expect(screen.queryByText("shot.png")).toBeNull();
});

it.each([
  [500, "Failed to upload the screenshot. Try again."],
  [401, sessionExpiredMessage],
])(
  "shows its own text, not the server's, for a %i upload refusal",
  async (status, shown) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    uploadRefusal = { status, message: "Framework text" };
    const { baseElement } = render(
      <DeleteAccountModal
        deleteAccount={() => Promise.reject(new Error("not called"))}
        userName="Test Member"
        userEmail="member@example.com"
        onCancel={() => {}}
        onDeleted={() => {}}
      />,
    );
    const input = baseElement.querySelector('input[type="file"]');
    if (!input) throw new Error("no file input");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "shot.png", { type: "image/png" })] },
    });

    expect(await screen.findByText(shown)).toBeTruthy();
    expect(screen.queryByText("Framework text")).toBeNull();
  },
);
