import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BlockPreview } from "./BlockPreview";

afterEach(cleanup);

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
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    expect(screen.getByText("Hello")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("renders the block outright when not toggleable", () => {
    renderPreview(false);
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
