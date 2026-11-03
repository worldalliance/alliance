import { fireEvent, render, screen } from "@testing-library/react";
import { CollapsibleFormSection } from "./FormSection";

const section = (inUse: boolean) => (
  <CollapsibleFormSection title="Completion" inUse={inUse}>
    <p>fields</p>
  </CollapsibleFormSection>
);

const toggle = () => screen.getByRole("button", { name: "Completion" });

const isOpen = () => toggle().getAttribute("aria-expanded") === "true";

describe("CollapsibleFormSection", () => {
  it("is a heading that names the section", () => {
    render(section(false));
    expect(screen.getByRole("heading", { name: "Completion" })).toBeTruthy();
  });

  it("stays open after its last field is cleared", () => {
    const { rerender } = render(section(true));
    expect(isOpen()).toBe(true);

    rerender(section(false));
    expect(isOpen()).toBe(true);
  });

  it("opens once a field is set", () => {
    const { rerender } = render(section(false));
    expect(isOpen()).toBe(false);
    expect(screen.getByText("fields").closest("[hidden]")).toBeTruthy();

    rerender(section(true));
    expect(isOpen()).toBe(true);
    expect(screen.getByText("fields").closest("[hidden]")).toBeNull();
  });

  it("stays closed after the admin closes it", () => {
    const { rerender } = render(section(true));
    fireEvent.click(toggle());

    rerender(section(false));
    rerender(section(true));
    expect(isOpen()).toBe(false);
  });

  it("stays open after the admin opens it", () => {
    const { rerender } = render(section(false));
    fireEvent.click(toggle());

    rerender(section(true));
    rerender(section(false));
    expect(isOpen()).toBe(true);
  });
});
