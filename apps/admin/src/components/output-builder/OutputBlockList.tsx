import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { outputBlockInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  OutputBlock,
  OutputFieldBlock,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import { useMemo } from "react";
import {
  addressedWrite,
  type BlockWriteById,
} from "../../lib/displayBlockById";
import { DropPosition, useDragReorder } from "../../lib/useDragReorder";
import { renderBlockEditor } from "../display-blocks/blockEditors";
import {
  ElementExpressionScope,
  expressionKeys,
} from "../form-fields/conditions/expressionBuffers";
import { EditableOutputFieldBlock } from "./EditableOutputFieldBlock";
import { OUTPUT_BY_KIND } from "./outputDisplayKinds";

const outputBlockKey = (block: OutputBlock, index: number) =>
  "kind" in block ? (block.id ?? `${block.kind}-${index}`) : block.id;

interface OutputBlockListProps {
  view: OutputViewSchema;
  outputFields: AnyField[];
  onBlocksChange: (blocks: OutputBlock[]) => void;
  onUpdateBlockById: BlockWriteById;
}

export function OutputBlockList({
  view,
  outputFields,
  onBlocksChange,
  onUpdateBlockById,
}: OutputBlockListProps) {
  const outputBlocks = useMemo(() => {
    const fieldLookup = new Map(outputFields.map((f) => [f.id, f]));
    return view.blocks
      .filter((b): b is OutputBlock & { id: string } => Boolean(b.id))
      .map((b) => ({
        id: b.id,
        label: outputBlockInternalDescriptor({
          block: b,
          fieldLookup,
          maxTextLength: 30,
        }),
      }));
  }, [view, outputFields]);

  const updateBlockAtIndex = (index: number, updates: Partial<OutputBlock>) => {
    const nextBlocks = view.blocks.map((block, idx) =>
      idx === index ? ({ ...block, ...updates } as OutputBlock) : block,
    );
    onBlocksChange(nextBlocks);
  };

  const removeBlockAtIndex = (index: number) => {
    const nextBlocks = view.blocks.filter((_, idx) => idx !== index);
    onBlocksChange(nextBlocks);
  };

  const {
    draggedIndex,
    dragOverIndex,
    dropPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  } = useDragReorder(view.blocks, onBlocksChange);

  const renderBlock = (block: OutputBlock, index: number) => {
    const showInsertionBar =
      dragOverIndex === index && dropPosition && draggedIndex !== null;
    const isDisplayBlock = (block as DisplayBlock).kind !== undefined;
    const dragProps = {
      onDragStart: handleDragStart(index),
      onDragEnd: handleDragEnd,
      isDragging: draggedIndex === index,
    };
    const handleDisplayUpdate = (updates: Partial<DisplayBlock>) =>
      updateBlockAtIndex(index, updates);
    const updateCurrent = addressedWrite(block, onUpdateBlockById);

    return (
      <div className="relative">
        {showInsertionBar && dropPosition === DropPosition.Before && (
          <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
        <div
          className="transition-all"
          onDragOver={handleDragOver(index)}
          onDrop={handleDrop(index)}
        >
          {isDisplayBlock ? (
            (() => {
              const displayBlock = block as DisplayBlock;
              if (!OUTPUT_BY_KIND[displayBlock.kind])
                throw new Error(
                  `output views can't show ${displayBlock.kind} blocks`,
                );
              return renderBlockEditor({
                block: displayBlock,
                onUpdate: handleDisplayUpdate,
                updateCurrent,
                onRemove: () => removeBlockAtIndex(index),
                previousFields: outputFields,
                outputBlocks,
                ...dragProps,
              });
            })()
          ) : (
            <EditableOutputFieldBlock
              block={block as OutputFieldBlock}
              availableFields={outputFields}
              outputBlocks={outputBlocks}
              onUpdate={(updates) => updateBlockAtIndex(index, updates)}
              onRemove={() => removeBlockAtIndex(index)}
              {...dragProps}
            />
          )}
        </div>
        {showInsertionBar && dropPosition === DropPosition.After && (
          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10">
            <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {view.blocks.length === 0 && (
        <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-6 text-center">
          No blocks added yet. Use the controls above to add display or output
          blocks.
        </div>
      )}
      {view.blocks.map((block, index) => (
        <ElementExpressionScope
          key={outputBlockKey(block, index)}
          parent={expressionKeys.outputView(view.id)}
          id={block.id}
        >
          {renderBlock(block, index)}
        </ElementExpressionScope>
      ))}
      {draggedIndex !== null && view.blocks.length > 0 && (
        <div
          className="relative h-4 -mt-2"
          onDragOver={handleDragOver(
            view.blocks.length - 1,
            DropPosition.After,
          )}
          onDrop={handleDrop(view.blocks.length - 1)}
        ></div>
      )}
    </div>
  );
}
