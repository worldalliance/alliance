import type { NestedDisplayKind } from "@alliance/common/forms/display-blocks";
import type { AddressedWrite } from "../../lib/displayBlockById";
import { NESTED_BLOCK_EDITORS } from "./nestedBlockEditors";
import type { BlockEditor, BlockOfKind } from "./types";

type Props<K extends NestedDisplayKind> = {
  block: BlockOfKind[K];
  updateCurrent: AddressedWrite;
  onRemove: () => void;
};

function renderNestedBlockEditor<K extends NestedDisplayKind>(
  kind: K,
  { block, updateCurrent, onRemove }: Props<K>,
) {
  const Editor: BlockEditor<K> | undefined = NESTED_BLOCK_EDITORS[kind];
  if (!Editor) throw new Error(`no editor for nested block kind ${kind}`);
  return (
    <Editor
      block={block}
      onUpdate={(updates) => updateCurrent(() => updates)}
      updateCurrent={updateCurrent}
      onRemove={onRemove}
    />
  );
}

export function EditableNestedBlock(props: Props<NestedDisplayKind>) {
  return renderNestedBlockEditor(props.block.kind, props);
}
