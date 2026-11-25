import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ToastProvider } from "../../ui/ToastProvider";
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

// Each editor has to hand its wrapper the addressed write.
const editors: {
  name: string;
  field: () => HTMLElement;
  mount: (w: Wiring) => DisplayBlock;
}[] = [
  {
    name: "EditableBigLinkBlock",
    field: () => screen.getByRole("textbox", { name: "Link label" }),
    mount: (w) => {
      const block = createDisplayBlock("biglink", "block-1");
      renderIn(<EditableBigLinkBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableChatTranscriptBlock",
    field: () => screen.getByRole("textbox", { name: "Left name" }),
    mount: (w) => {
      const block = createDisplayBlock("chatTranscript", "block-1");
      renderIn(<EditableChatTranscriptBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableCopyTextBlock",
    field: () => screen.getByRole("textbox", { name: "Text to copy" }),
    mount: (w) => {
      const block = createDisplayBlock("copytext", "block-1");
      renderIn(<EditableCopyTextBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditablePreviousAnswerBlock",
    field: () => screen.getByRole("textbox", { name: "Title" }),
    mount: (w) => {
      const block = createDisplayBlock("previousAnswer", "block-1");
      renderIn(<EditablePreviousAnswerBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableUserLocationBlock",
    field: () => screen.getByRole("textbox", { name: "Title" }),
    mount: (w) => {
      const block = createDisplayBlock("userLocation", "block-1");
      renderIn(<EditableUserLocationBlock {...w} block={block} />);
      return block;
    },
  },
  {
    name: "EditableVideoBlock",
    field: () => screen.getByPlaceholderText("Add an optional caption"),
    mount: (w) => {
      const block = createDisplayBlock("video", "block-1");
      renderIn(<EditableVideoBlock {...w} block={block} />);
      return block;
    },
  },
];

describe("a block editor forwards the addressed write", () => {
  for (const { name, field, mount } of editors) {
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

      fireEvent.change(field(), {
        target: { value: "edited" },
      });

      expect(wrote).toEqual(["updateCurrent"]);
    });
  }
});
