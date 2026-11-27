import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useState } from "react";
import {
  ALL_SECTIONS,
  SectionPanels,
  SidebarSection,
  SidebarSections,
} from "./sidebarSections";

function Inspector() {
  const [section, setSection] = useState(SidebarSection.Content);
  return (
    <div data-testid="pane" style={{ overflowY: "auto" }}>
      <SidebarSections
        sections={ALL_SECTIONS}
        active={section}
        onSelect={setSection}
      >
        <SectionPanels content="Long content" advanced="Short advanced" />
      </SidebarSections>
    </div>
  );
}

afterEach(() => jest.restoreAllMocks());

describe("SidebarSections, as Output views' inspector uses it alone", () => {
  it("starts a tab opened while scrolled down right under the stuck tabs", async () => {
    render(<Inspector />);
    const pane = screen.getByTestId("pane");
    pane.scrollTop = 400;
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const role = this.getAttribute("role");
        if (role === "tablist") return DOMRect.fromRect({ y: 48, height: 40 });
        if (role === "tabpanel") return DOMRect.fromRect({ y: -212 });
        return new DOMRect();
      });
    await act(async () =>
      fireEvent.click(screen.getByRole("tab", { name: "Advanced" })),
    );
    expect(pane.scrollTop).toBe(100);
  });
});
