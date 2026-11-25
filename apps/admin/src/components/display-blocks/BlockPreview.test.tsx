import { fireEvent, render, screen } from "@testing-library/react";
import { SiteOriginLinkProvider } from "../../ui/SiteAppProvider";
import { BlockPreview } from "./BlockPreview";

const header = { type: "display", kind: "header", text: "Hello" } as const;
const renderPreview = (toggleable: boolean) =>
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <BlockPreview block={header} toggleable={toggleable} />
    </SiteOriginLinkProvider>,
  );

describe("BlockPreview", () => {
  it("renders the block behind its toggle", () => {
    renderPreview(true);
    expect(screen.queryByText("Hello")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show preview" }));
    expect(screen.getByText("Hello")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show preview" }));
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("renders the block outright when not toggleable", () => {
    renderPreview(false);
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
