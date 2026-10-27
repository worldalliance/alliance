import type { ImagesBlock } from "@alliance/common/forms/display-blocks";
import { R, type Result } from "@alliance/common/result";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as download from "../lib/downloadImage";
import { ToastProvider } from "../ui/ToastProvider";
import RenderDisplayBlock from "./RenderDisplayBlock";

afterEach(() => jest.restoreAllMocks());

const block = (fields: Partial<ImagesBlock>): ImagesBlock => ({
  id: "images-1",
  type: "display",
  kind: "images",
  images: [{ src: "https://cdn.example.com/images/1.webp" }],
  ...fields,
});

const renderBlock = (fields: Partial<ImagesBlock>) =>
  render(
    <ToastProvider>
      <RenderDisplayBlock block={block(fields)} />
    </ToastProvider>,
  );

it("shows no download button unless the block asks for one", () => {
  renderBlock({});
  expect(screen.queryByRole("button", { name: "Download image" })).toBeNull();
});

it("downloads the image its button sits on", () => {
  const downloadImage = jest
    .spyOn(download, "downloadImage")
    .mockResolvedValue(R.success(undefined));
  renderBlock({
    downloadable: true,
    images: [
      { src: "https://cdn.example.com/images/1.webp" },
      { src: "https://cdn.example.com/images/2.webp", fileName: "Two" },
    ],
  });

  fireEvent.click(screen.getAllByRole("button", { name: "Download image" })[1]);

  expect(downloadImage).toHaveBeenCalledWith({
    src: "https://cdn.example.com/images/2.webp",
    name: "Two",
  });
});

it("says so when the download fails", async () => {
  jest
    .spyOn(download, "downloadImage")
    .mockResolvedValue(R.failure(new Error("Image download failed: 500")));
  jest.spyOn(console, "error").mockImplementation(() => {});
  renderBlock({ downloadable: true });

  fireEvent.click(screen.getByRole("button", { name: "Download image" }));

  await waitFor(() =>
    expect(
      screen.getByText("Couldn't download the image. Try again in a moment."),
    ).toBeTruthy(),
  );
});

it("disables its button while the download runs", async () => {
  let finish = (_result: Result<void, Error>) => {};
  jest
    .spyOn(download, "downloadImage")
    .mockImplementation(() => new Promise((resolve) => (finish = resolve)));
  renderBlock({ downloadable: true });
  const button = () =>
    screen.getByRole<HTMLButtonElement>("button", { name: "Download image" });

  fireEvent.click(button());
  expect(button().disabled).toBe(true);

  await act(async () => finish(R.success(undefined)));
  expect(button().disabled).toBe(false);
});
