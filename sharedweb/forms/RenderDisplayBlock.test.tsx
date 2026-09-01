import type {
  AccordionBlock,
  BigLinkBlock,
} from "@alliance/common/forms/display-blocks";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthoredLinkProvider, SiteAppProvider } from "../ui/SiteAppProvider";
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

const biglink: BigLinkBlock = {
  type: "display",
  kind: "biglink",
  id: "block-1",
  text: "Read the post",
  url: "https://worldalliance.org/forum/post/22",
};

const hrefOf = (node: React.ReactNode): string | null => {
  render(<MemoryRouter>{node}</MemoryRouter>);
  return screen.getByRole("link").getAttribute("href");
};

describe("the biglink display block", () => {
  it("drops our own domain in the app that serves it", () => {
    expect(
      hrefOf(
        <SiteAppProvider>
          <RenderDisplayBlock block={biglink} />
        </SiteAppProvider>,
      ),
    ).toBe("/forum/post/22");
  });

  it("shows the destination it links to", () => {
    render(
      <MemoryRouter>
        <SiteAppProvider>
          <RenderDisplayBlock block={biglink} />
        </SiteAppProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText(biglink.url)).toBeNull();
    expect(screen.getByText("/forum/post/22")).toBeTruthy();
  });

  it("keeps the authored URL in an app that serves another domain", () => {
    expect(
      hrefOf(
        <AuthoredLinkProvider>
          <RenderDisplayBlock block={biglink} />
        </AuthoredLinkProvider>,
      ),
    ).toBe("https://worldalliance.org/forum/post/22");
  });

  it("refuses to render in an app that has claimed neither", () => {
    expect(() => hrefOf(<RenderDisplayBlock block={biglink} />)).toThrow();
  });
});
