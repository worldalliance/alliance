import {
  CopyTextFormat,
  type AccordionBlock,
  type BigLinkBlock,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider, SiteOriginLinkProvider } from "../ui/SiteAppProvider";
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

  it("aims the link at the given origin in an app that serves another domain", () => {
    expect(
      hrefOf(
        <SiteOriginLinkProvider origin="https://staging.thealliance.org">
          <RenderDisplayBlock block={biglink} />
        </SiteOriginLinkProvider>,
      ),
    ).toBe("https://staging.thealliance.org/forum/post/22");
  });

  it("refuses to render in an app that has claimed neither", () => {
    expect(() => hrefOf(<RenderDisplayBlock block={biglink} />)).toThrow();
  });
});

describe("the copytext display block", () => {
  const copytext: CopyTextBlock = {
    type: "display",
    kind: "copytext",
    id: "block-1",
    text: "Dear council",
  };

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["Copied!", () => Promise.resolve()],
    ["Copy failed", () => Promise.reject(new DOMException("denied"))],
  ])("says %s", async (label, writeText) => {
    jest.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    render(<RenderDisplayBlock block={copytext} />);

    fireEvent.click(screen.getByText("Dear council"));

    expect(await screen.findByText(label)).toBeTruthy();
  });

  it("follows a link in a rich block without copying", () => {
    const write = jest.fn(() => Promise.resolve());
    jest.spyOn(navigator.clipboard, "write").mockImplementation(write);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SiteAppProvider>
          <RenderDisplayBlock
            block={{
              ...copytext,
              text: "See [the plan](https://example.org)",
              format: CopyTextFormat.Markdown,
            }}
          />
        </SiteAppProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText("the plan"));

    expect(write).not.toHaveBeenCalled();
  });

  it("doesn't copy on a click in a link's hover card", async () => {
    const write = jest.fn(() => Promise.resolve());
    jest.spyOn(navigator.clipboard, "write").mockImplementation(write);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SiteAppProvider>
          <RenderDisplayBlock
            block={{
              ...copytext,
              text: "See [the plan](https://example.org/plan)",
              format: CopyTextFormat.Markdown,
            }}
          />
        </SiteAppProvider>
      </QueryClientProvider>,
    );

    fireEvent.pointerEnter(screen.getByText("the plan"));
    fireEvent.mouseEnter(screen.getByText("the plan"));
    const card = await screen.findByText("example.org");
    fireEvent.click(card);

    expect(write).not.toHaveBeenCalled();
  });

  it("renders and copies markdown when rich", async () => {
    const write = jest.fn(() => Promise.resolve());
    jest.spyOn(navigator.clipboard, "write").mockImplementation(write);
    render(
      <SiteAppProvider>
        <RenderDisplayBlock
          block={{
            ...copytext,
            text: "Dear **council**",
            format: CopyTextFormat.Markdown,
          }}
        />
      </SiteAppProvider>,
    );

    fireEvent.click(screen.getByText("council"));

    expect(screen.getByText("council").tagName).toBe("STRONG");
    expect(await screen.findByText("Copied!")).toBeTruthy();
    expect(write).toHaveBeenCalledTimes(1);
  });
});
