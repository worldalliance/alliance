import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import DeleteAccountModal from "./DeleteAccountModal";

afterEach(cleanup);

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
      userId={5}
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
        userId={5}
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
