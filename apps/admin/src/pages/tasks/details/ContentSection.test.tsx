import { fireEvent, screen } from "@testing-library/react";
import { LinkedField } from "../../../lib/linkedSelection";
import { renderForm, section } from "./renderDetailsForm";

describe("ContentSection", () => {
  it("lays out the text fields, the cover image, then the thumbnail pair", () => {
    renderForm();

    expect(
      Array.from(
        section("Content").querySelectorAll("input, textarea"),
        (input) => input.getAttribute("name"),
      ).slice(0, 6),
    ).toEqual([
      "name",
      "shortDescription",
      "body",
      "image",
      "squareThumbnailImage",
      "squareThumbnailImageAlt",
    ]);
    expect(screen.getByLabelText<HTMLTextAreaElement>(/^Name/).value).toBe(
      "Call your rep",
    );
  });

  it("forwards edits to the draft", () => {
    const { edits } = renderForm();

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Write your rep" },
    });

    expect(edits).toEqual([["name", "Write your rep"]]);
  });

  it("gives each linked text field's textarea the name a link selects in", () => {
    renderForm();

    for (const field of Object.values(LinkedField)) {
      expect(
        document.querySelector(`textarea[name="${field}"]`),
      ).toBeInstanceOf(HTMLTextAreaElement);
    }
  });
});
