import type { NestedDisplayBlock } from "@alliance/common/forms/display-blocks";
import { EditableBigLinkBlock } from "./EditableBigLinkBlock";
import { EditableChatTranscriptBlock } from "./EditableChatTranscriptBlock";
import { EditableCopyTextBlock } from "./EditableCopyTextBlock";
import { EditableDividerBlock } from "./EditableDividerBlock";
import { EditableHeaderBlock } from "./EditableHeaderBlock";
import { EditableHtmlBlock } from "./EditableHtmlBlock";
import { EditableImagesBlock } from "./EditableImagesBlock";
import { EditableLabelBlock } from "./EditableLabelBlock";
import { EditableQuoteBlock } from "./EditableQuoteBlock";
import { EditableSpacerBlock } from "./EditableSpacerBlock";
import { EditableTextBlock } from "./EditableTextBlock";
import { EditableVideoBlock } from "./EditableVideoBlock";

type Props = {
  block: NestedDisplayBlock;
  onChange: (next: NestedDisplayBlock) => void;
  onRemove: () => void;
};

export function EditableNestedBlock({ block, onChange, onRemove }: Props) {
  switch (block.kind) {
    case "header":
      return (
        <EditableHeaderBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "text":
      return (
        <EditableTextBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "label":
      return (
        <EditableLabelBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "quote":
      return (
        <EditableQuoteBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "divider":
      return (
        <EditableDividerBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "spacer":
      return (
        <EditableSpacerBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "html":
      return (
        <EditableHtmlBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "images":
      return (
        <EditableImagesBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "video":
      return (
        <EditableVideoBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "biglink":
      return (
        <EditableBigLinkBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "copytext":
      return (
        <EditableCopyTextBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    case "chatTranscript":
      return (
        <EditableChatTranscriptBlock
          block={block}
          onUpdate={(updates) => onChange({ ...block, ...updates })}
          onRemove={onRemove}
        />
      );
    default:
      throw new Error(`unknown nested block kind: ${block satisfies never}`);
  }
}
