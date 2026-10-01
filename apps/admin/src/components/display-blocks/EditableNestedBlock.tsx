import type { NestedDisplayKind } from "@alliance/common/forms/display-blocks";
import { ElementJsonContext } from "../FormJsonButton";
import { NESTED_BLOCK_EDITORS } from "./nestedBlockEditors";
import type { BlockEditor, BlockOfKind } from "./types";

type Props<K extends NestedDisplayKind> = {
  block: BlockOfKind[K];
  onChange: (next: BlockOfKind[K]) => void;
  onRemove: () => void;
};

function renderNestedBlockEditor<K extends NestedDisplayKind>(
  kind: K,
  { block, onChange, onRemove }: Props<K>,
) {
  const Editor: BlockEditor<K> | undefined = NESTED_BLOCK_EDITORS[kind];
  if (!Editor) throw new Error(`no editor for nested block kind ${kind}`);
  return (
    <ElementJsonContext.Provider value={null}>
      <Editor
        block={block}
        onUpdate={(updates) => onChange({ ...block, ...updates })}
        onRemove={onRemove}
      />
    </ElementJsonContext.Provider>
  );
}

export function EditableNestedBlock(props: Props<NestedDisplayKind>) {
  return renderNestedBlockEditor(props.block.kind, props);
}
