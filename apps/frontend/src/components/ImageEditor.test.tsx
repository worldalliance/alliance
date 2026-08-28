import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import ImageEditor from "./ImageEditor";

afterEach(cleanup);

const EXISTING = "https://cdn.example.com/existing.webp";

const renderEditor = (props: { canRemove?: boolean } = {}) => {
  const reported: (string | null)[] = [];
  const { container } = render(
    <ImageEditor
      initialImageUrl={EXISTING}
      onChange={(value) => reported.push(value)}
      allowedMimeTypes={["image/png"]}
      {...props}
    />,
  );
  return { container, reported };
};

const pickFile = async (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("no file input");
  await act(async () => {
    fireEvent.change(input, {
      target: {
        files: [new File(["not-an-image"], "photo.png", { type: "image/png" })],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

describe("ImageEditor", () => {
  it("reports nothing for a pick whose crop never lands", async () => {
    const { container, reported } = renderEditor();

    await pickFile(container);

    expect(reported).toEqual([]);
  });

  it("reports null when the user removes the photo", () => {
    const { reported } = renderEditor({ canRemove: true });

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    expect(reported).toEqual([null]);
  });

  it("offers no remove control by default", () => {
    renderEditor();

    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
  });
});
