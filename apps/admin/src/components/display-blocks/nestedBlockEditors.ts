import type { NestedDisplayKind } from "@alliance/common/forms/display-blocks";
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
import type { BlockEditor } from "./types";

export const NESTED_BLOCK_EDITORS: {
  [K in NestedDisplayKind]: BlockEditor<K>;
} = {
  header: EditableHeaderBlock,
  text: EditableTextBlock,
  label: EditableLabelBlock,
  divider: EditableDividerBlock,
  spacer: EditableSpacerBlock,
  html: EditableHtmlBlock,
  images: EditableImagesBlock,
  video: EditableVideoBlock,
  quote: EditableQuoteBlock,
  biglink: EditableBigLinkBlock,
  copytext: EditableCopyTextBlock,
  chatTranscript: EditableChatTranscriptBlock,
};
