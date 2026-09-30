import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditableCopyTextBlock } from "./EditableCopyTextBlock";

afterEach(cleanup);

serveApi(routes({ "GET /user/list": () => Response.json([]) }));

const renderEditor = (block: CopyTextBlock, onUpdate = jest.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <SiteOriginLinkProvider origin="https://thealliance.org">
          <EditableCopyTextBlock
            block={block}
            onUpdate={onUpdate}
            onRemove={() => {}}
          />
        </SiteOriginLinkProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onUpdate;
};

const toggleFrom = (block: CopyTextBlock) => {
  const onUpdate = renderEditor(block);
  fireEvent.click(screen.getByRole("button", { name: "Rich text" }));
  return onUpdate.mock.calls[0][0];
};

const plain: CopyTextBlock = {
  type: "display",
  kind: "copytext",
  id: "block-1",
  text: "",
};

describe("the copy text rich text toggle", () => {
  it("turns markdown on", () => {
    expect(toggleFrom(plain)).toEqual({ format: CopyTextFormat.Markdown });
  });

  it("turns markdown off", () => {
    expect(toggleFrom({ ...plain, format: CopyTextFormat.Markdown })).toEqual({
      format: undefined,
    });
  });

  it("sets every user's content alike", () => {
    expect(
      toggleFrom({
        ...plain,
        manualPerUser: true,
        manualUserContent: {
          "7": { text: "Dear Ana" },
          "8": { text: "Dear Ben", format: CopyTextFormat.Plain },
        },
      }),
    ).toEqual({
      format: CopyTextFormat.Markdown,
      manualUserContent: {
        "7": { text: "Dear Ana", format: CopyTextFormat.Markdown },
        "8": { text: "Dear Ben", format: CopyTextFormat.Markdown },
      },
    });
  });
});

describe("the copy text preview", () => {
  it("renders a rich block's markdown", () => {
    renderEditor({
      ...plain,
      text: "Dear **council**",
      format: CopyTextFormat.Markdown,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));

    expect(screen.getByText("council").tagName).toBe("STRONG");
  });

  it("isn't offered for a plain block", () => {
    renderEditor(plain);

    expect(screen.queryByRole("button", { name: "Show preview" })).toBeNull();
  });
});
