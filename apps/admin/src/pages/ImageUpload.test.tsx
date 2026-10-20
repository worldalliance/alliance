import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import ImageUpload from "./ImageUpload";

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

it("says why an upload was refused", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(<ImageUpload />);
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("no file input");
  fireEvent.change(input, {
    target: { files: [new File(["x"], "pic.png", { type: "image/png" })] },
  });
  // Upload sends nothing until the file has been read, which shows nothing.
  await waitFor(() => {
    if (screen.queryByText("Image is too large")) return;
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    throw new Error("no refusal shown yet");
  });
});

it.each([
  [500, "Failed to upload image."],
  [401, sessionExpiredMessage],
])(
  "shows its own text, not the server's, for a %i upload refusal",
  async (status, shown) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    uploadRefusal = { status, message: "Framework text" };
    const { container } = render(<ImageUpload />);
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("no file input");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "pic.png", { type: "image/png" })] },
    });
    await waitFor(() => {
      if (screen.queryByText(shown)) return;
      fireEvent.click(screen.getByRole("button", { name: "Upload" }));
      throw new Error("no refusal shown yet");
    });
    expect(screen.queryByText("Framework text")).toBeNull();
  },
);
