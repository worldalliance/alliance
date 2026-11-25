import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, jest } from "bun:test";
import type { CardImageChoice } from "../lib/actionUpdateDetails";
import { ActionUpdateCardImageField } from "./ActionUpdateCardImageField";

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
    <ActionUpdateCardImageField
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
