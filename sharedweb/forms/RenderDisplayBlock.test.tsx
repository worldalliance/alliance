import type { AccordionBlock } from "@alliance/common/forms/display-blocks";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RenderDisplayBlock from "./RenderDisplayBlock";

afterEach(cleanup);

const accordion = (singleOpen?: boolean): AccordionBlock => ({
  type: "display",
  kind: "accordion",
  id: "block-1",
  singleOpen,
  sections: [
    {
      id: "section-1",
      title: "First",
      blocks: [{ type: "display", kind: "label", id: "a", text: "Inside one" }],
    },
    {
      id: "section-2",
      title: "Second",
      blocks: [{ type: "display", kind: "label", id: "b", text: "Inside two" }],
    },
  ],
});

describe("the accordion display block", () => {
  it("reveals a section's blocks when its trigger is pressed", () => {
    render(<RenderDisplayBlock block={accordion()} />);

    expect(screen.queryByText("Inside one")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    expect(screen.getByText("Inside one")).toBeTruthy();
  });

  it("keeps sections open independently by default", () => {
    render(<RenderDisplayBlock block={accordion()} />);

    fireEvent.click(screen.getByRole("button", { name: "First" }));
    fireEvent.click(screen.getByRole("button", { name: "Second" }));

    expect(screen.getByText("Inside one")).toBeTruthy();
    expect(screen.getByText("Inside two")).toBeTruthy();
  });

  it("closes the open section when singleOpen is set", () => {
    render(<RenderDisplayBlock block={accordion(true)} />);

    fireEvent.click(screen.getByRole("button", { name: "First" }));
    fireEvent.click(screen.getByRole("button", { name: "Second" }));

    expect(screen.queryByText("Inside one")).toBeNull();
    expect(screen.getByText("Inside two")).toBeTruthy();
  });
});
