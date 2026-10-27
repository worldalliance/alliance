import { type AnyField } from "@alliance/common/forms/form-schema";
import { outputFieldPublicToggle } from "../lib/copy";
import { outputPublicToggle } from "./outputPublicToggle";

const field = (output?: AnyField["output"]): AnyField => ({
  id: "answer",
  type: "input",
  kind: "text",
  label: "Answer",
  output,
});

describe("outputPublicToggle", () => {
  it("shows no toggle for a field that isn't an output", () => {
    expect(outputPublicToggle(field(), true)).toBeNull();
    expect(outputPublicToggle(field({ output: false }), true)).toBeNull();
  });

  it.each([
    { sharePublicly: true, checked: false },
    { sharePublicly: false, checked: true },
  ])(
    "offers to hide a public-by-default response, checked when hidden (sharePublicly=$sharePublicly)",
    ({ sharePublicly, checked }) => {
      const toggle = outputPublicToggle(field({ output: true }), sharePublicly);
      expect(toggle?.label).toBe(outputFieldPublicToggle.hidePublicly);
      expect(toggle?.checked).toBe(checked);
      expect(toggle?.sharePubliclyWhen(true)).toBe(false);
      expect(toggle?.sharePubliclyWhen(false)).toBe(true);
    },
  );

  it.each([
    { sharePublicly: true, checked: true },
    { sharePublicly: false, checked: false },
  ])(
    "offers to show a private-by-default response, checked when shown (sharePublicly=$sharePublicly)",
    ({ sharePublicly, checked }) => {
      const toggle = outputPublicToggle(
        field({ output: true, privateByDefault: true }),
        sharePublicly,
      );
      expect(toggle?.label).toBe(outputFieldPublicToggle.showPublicly);
      expect(toggle?.checked).toBe(checked);
      expect(toggle?.sharePubliclyWhen(true)).toBe(true);
      expect(toggle?.sharePubliclyWhen(false)).toBe(false);
    },
  );
});
