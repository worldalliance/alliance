import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { createRef } from "react";
import { PaneHeader, Workspace } from "./Workspace";

afterEach(cleanup);

describe("Workspace", () => {
  it("hands each pane's scrolling element to its ref", () => {
    const navigatorRef = createRef<HTMLDivElement>();
    const canvasRef = createRef<HTMLDivElement>();
    const inspectorRef = createRef<HTMLDivElement>();
    render(
      <Workspace
        navigator="Outline"
        inspector="Properties"
        navigatorRef={navigatorRef}
        canvasRef={canvasRef}
        inspectorRef={inspectorRef}
      >
        Canvas
      </Workspace>,
    );
    for (const [ref, text] of [
      [navigatorRef, "Outline"],
      [canvasRef, "Canvas"],
      [inspectorRef, "Properties"],
    ] as const) {
      expect(ref.current?.textContent).toBe(text);
      expect(ref.current?.className).toContain("overflow-y-auto");
      expect(ref.current?.className).toContain("overflow-x-hidden");
      expect(ref.current?.className).toContain("scrollbar-stable");
    }
  });
});

describe("PaneHeader", () => {
  it("keeps a long title to one line with the full text in its title", () => {
    const long = "A very long element label that would otherwise wrap";
    render(
      <PaneHeader
        title={long}
        leading={<button type="button">Back to Page 1</button>}
        action={<button type="button">Delete</button>}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: long });
    expect(heading.className).toContain("truncate");
    expect(heading.getAttribute("title")).toBe(long);
    expect(
      screen
        .getByRole("button", { name: "Back to Page 1" })
        .compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
