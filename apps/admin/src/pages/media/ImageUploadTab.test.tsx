import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { escapeRegExp } from "es-toolkit";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import MediaPlace from "../../places/MediaPlace";
import { ToastProvider } from "../../ui/ToastProvider";

let uploadRefusal: { status: number; message: string } | null;
let uploads = 0;
beforeEach(() => {
  uploadRefusal = { status: 400, message: "Image is too large" };
  uploads = 0;
});

serveApi(
  routes({
    "POST /images/uploadImage": () => {
      uploads += 1;
      return uploadRefusal
        ? Response.json({ message: uploadRefusal.message }, uploadRefusal)
        : Response.json({ url: "https://cdn.test/pic.webp", key: "pic" });
    },
  }),
);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/content/media"]}>
      <ToastProvider>
        <MediaPlace />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const choosePicture = () =>
  fireEvent.change(screen.getByLabelText("Image"), {
    target: { files: [new File(["x"], "pic.png", { type: "image/png" })] },
  });

it("says why an upload was refused", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  renderPage();
  choosePicture();
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));

  expect(await screen.findByText(/Image is too large/)).toBeTruthy();
});

it.each([
  [500, "Failed to upload image."],
  [401, sessionExpiredMessage],
])(
  "shows its own text, not the server's, for a %i upload refusal",
  async (status, shown) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    uploadRefusal = { status, message: "Framework text" };
    renderPage();
    choosePicture();
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(
      await screen.findByText(new RegExp(escapeRegExp(shown))),
    ).toBeTruthy();
    expect(screen.queryByText(/Framework text/)).toBeNull();
  },
);

it("asks for an image, sending nothing, when none is chosen", async () => {
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));

  expect(await screen.findByText("Choose an image to upload")).toBeTruthy();
  expect(screen.getByLabelText("Image").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(uploads).toBe(0);
});

it("shows the uploaded image and its link, which it copies", async () => {
  uploadRefusal = null;
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  renderPage();
  choosePicture();
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));

  const link = await screen.findByLabelText<HTMLInputElement>("Link");
  expect(link.value).toBe("https://cdn.test/pic.webp");
  expect(
    screen.getByRole("img", { name: "The uploaded image" }).getAttribute("src"),
  ).toBe("https://cdn.test/pic.webp");

  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith("https://cdn.test/pic.webp"),
  );
});
