import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { createDisplayBlock } from "./createDisplayBlock";
import { EditableBigLinkBlock } from "./EditableBigLinkBlock";
import { EditableChatTranscriptBlock } from "./EditableChatTranscriptBlock";
import { EditableCopyTextBlock } from "./EditableCopyTextBlock";
import { EditablePreviousAnswerBlock } from "./EditablePreviousAnswerBlock";
import { EditableUserLocationBlock } from "./EditableUserLocationBlock";
import { EditableVideoBlock } from "./EditableVideoBlock";
import type { BaseDisplayBlockProps } from "./types";

type Wiring = Omit<BaseDisplayBlockProps<DisplayBlock>, "block">;

const renderIn = (editor: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>{editor}</ToastProvider>
    </QueryClientProvider>,
  );

// These list their wrapper props by hand, so each has to forward the addressed
// write rather than getting it from a spread.
const editors: {
  name: string;
  placeholder: string;
  mount: (w: Wiring) => DisplayBlock;
}[] = [
  {
    name: "EditableBigLinkBlock",
    placeholder: "Link label",
    mount: (w) => {
      const block = createDisplayBlock("biglink", "block-1");
      renderIn(<EditableBigLinkBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableChatTranscriptBlock",
    placeholder: "Left user name",
    mount: (w) => {
      const block = createDisplayBlock("chatTranscript", "block-1");
      renderIn(<EditableChatTranscriptBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableCopyTextBlock",
    placeholder: "Text to copy",
    mount: (w) => {
      const block = createDisplayBlock("copytext", "block-1");
      renderIn(<EditableCopyTextBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditablePreviousAnswerBlock",
    placeholder: "Display title",
    mount: (w) => {
      const block = createDisplayBlock("previousAnswer", "block-1");
      renderIn(<EditablePreviousAnswerBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableUserLocationBlock",
    placeholder: "Your location",
    mount: (w) => {
      const block = createDisplayBlock("userLocation", "block-1");
      renderIn(<EditableUserLocationBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableVideoBlock",
    placeholder: "Add an optional caption",
    mount: (w) => {
      const block = createDisplayBlock("video", "block-1");
      renderIn(<EditableVideoBlock {...w} block={block} />);
      return block;
    },
  },
];

afterEach(cleanup);

describe("a block editor forwards the addressed write", () => {
  for (const { name, placeholder, mount } of editors) {
    it(name, () => {
      const wrote: string[] = [];
      const block = mount({
        onUpdate: () => wrote.push("onUpdate"),
        updateCurrent: () => {
          wrote.push("updateCurrent");
          return block;
        },
        onRemove: () => {},
      });

      fireEvent.change(screen.getByPlaceholderText(placeholder), {
        target: { value: "edited" },
      });

      expect(wrote).toEqual(["updateCurrent"]);
    });
  }
});
