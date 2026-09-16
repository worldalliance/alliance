import type {
  DisplayBlock,
  DisplayKind,
} from "@alliance/common/forms/display-blocks";
import { EditableAccordionBlock } from "./EditableAccordionBlock";
import { EditablePreviousAnswerBlock } from "./EditablePreviousAnswerBlock";
import { EditableUserLocationBlock } from "./EditableUserLocationBlock";
import { NESTED_BLOCK_EDITORS } from "./nestedBlockEditors";
import type { BaseDisplayBlockProps, BlockEditor, BlockOfKind } from "./types";

const BLOCK_EDITORS: { [K in DisplayKind]: BlockEditor<K> } = {
  ...NESTED_BLOCK_EDITORS,
  previousAnswer: EditablePreviousAnswerBlock,
  userLocation: EditableUserLocationBlock,
  accordion: EditableAccordionBlock,
};

function renderEditorOfKind<K extends DisplayKind>(
  kind: K,
  props: BaseDisplayBlockProps<BlockOfKind[K]>,
) {
  const Editor: BlockEditor<K> | undefined = BLOCK_EDITORS[kind];
  if (!Editor) {
    console.error(`Unknown block kind: ${kind}`);
    return null;
  }
  return <Editor {...props} />;
}

export function renderBlockEditor(props: BaseDisplayBlockProps<DisplayBlock>) {
  return renderEditorOfKind(props.block.kind, props);
}
