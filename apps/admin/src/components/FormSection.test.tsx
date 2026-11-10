import { render, screen } from "@testing-library/react";
import { CollapsibleFormSection } from "./FormSection";

const section = (inUse: boolean) => (
  <CollapsibleFormSection title="Completion" inUse={inUse}>
    <span>Optional</span>
  </CollapsibleFormSection>
);

const details = () => {
  const element = screen.getByText("Optional").closest("details");
  if (!element) throw new Error("no details element");
  return element;
};

describe("CollapsibleFormSection", () => {
  it("opens once a field is set and stays open when it is cleared", () => {
    const { rerender } = render(section(false));
    expect(details().open).toBe(false);

    rerender(section(true));
    expect(details().open).toBe(true);

    rerender(section(false));
    expect(details().open).toBe(true);
  });
});
