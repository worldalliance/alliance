import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { R, type Result } from "@alliance/common/result";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import * as uploadModule from "@alliance/shared/lib/uploadImageDataUri";
import * as readFileDataUriModule from "@alliance/sharedweb/lib/readFileDataUri";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import type { CardImageChoice } from "../../../lib/actionUpdateDetails";
import { CardImageField } from "./CardImageField";

const schema: DisplayOnlySchema = {
  blocks: [
    {
      type: "display",
      kind: "images",
      images: [
        { src: "1793-volunteers.webp", alt: "Volunteers" },
        { src: "https://example.org/linked.png", alt: "Linked" },
      ],
    },
  ],
};

const renderField = (params: {
  savedSrc: string | null;
  choice: CardImageChoice;
}) => {
  const onChange = jest.fn();
  render(
    <CardImageField
      savedSrc={params.savedSrc}
      schema={schema}
      choice={params.choice}
      onChange={onChange}
    />,
  );
  return onChange;
};

it("offers the update's uploaded images, not linked ones, as the card image", () => {
  const onChange = renderField({
    savedSrc: null,
    choice: { kind: "unchanged" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Use Volunteers as the card image" }),
  );

  expect(onChange).toHaveBeenCalledWith({
    kind: "set",
    key: "1793-volunteers.webp",
  });
  expect(
    screen.queryByRole("button", { name: "Use Linked as the card image" }),
  ).toBeNull();
  expect(screen.getByText(/No card image/)).toBeTruthy();
});

it("removes a saved card image and shows the fallback once removed", () => {
  const onChange = renderField({
    savedSrc: "https://cdn.example.org/card.webp",
    choice: { kind: "unchanged" },
  });
  expect(screen.getByAltText("Card image preview")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Remove card image" }));
  expect(onChange).toHaveBeenCalledWith({ kind: "cleared" });
});

describe("uploading a card image", () => {
  let uploads: Pending<Result<string, string>>[] = [];
  beforeEach(() => {
    uploads = [];
    jest
      .spyOn(readFileDataUriModule, "readFileDataUri")
      .mockResolvedValue(R.success("data:image/png;base64,aaa"));
    jest
      .spyOn(uploadModule, "uploadImageDataUri")
      .mockImplementation((_dataUri, signal) => pending(uploads, signal));
  });
  afterEach(() => jest.restoreAllMocks());

  const chooseFile = async () => {
    fireEvent.change(screen.getByLabelText("Choose file…"), {
      target: { files: [new File(["x"], "card.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploads).toHaveLength(1));
  };

  it("sets the uploaded key as the card image", async () => {
    const onChange = renderField({
      savedSrc: null,
      choice: { kind: "unchanged" },
    });
    await chooseFile();
    expect(screen.getByRole("status").textContent).toBe("Uploading…");

    await act(async () => uploads[0]!.resolve(R.success("uploads/card.webp")));

    expect(onChange).toHaveBeenCalledWith({
      kind: "set",
      key: "uploads/card.webp",
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says why an upload failed, until another image is chosen", async () => {
    const onChange = renderField({
      savedSrc: null,
      choice: { kind: "unchanged" },
    });
    await chooseFile();

    await act(async () => uploads[0]!.resolve(R.failure("Too large.")));

    expect(screen.getByRole("alert").textContent).toBe("Too large.");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Use Volunteers as the card image" }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
