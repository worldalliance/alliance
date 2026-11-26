import { outputBlockInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  OutputBlock,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import { GripVertical, Plus } from "lucide-react";
import { useMemo } from "react";
import { DropPosition, useDragReorder } from "../../../../lib/useDragReorder";
import { ButtonVariant, buttonVariants } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../ui/DropdownMenu";
import { MoreMenu, type MoreMenuItem } from "../../../../ui/MoreMenu";
import {
  DISPLAY_BLOCK_KINDS,
  OUTPUT_BY_KIND,
  type OutputDisplayBlockKind,
} from "./outputDisplayKinds";
import {
  DISPLAY_KIND_LABELS,
  OutputTarget,
  outputBlockKey,
  type OutputSelection,
} from "./outputSelection";

const ROW =
  "flex min-h-control items-center rounded-md px-2 text-left focus-ring hover:bg-surface-2";
const SELECTED = "bg-accent-soft hover:bg-accent-soft";

/** Move up, Move down and Remove for the block at `index`, in a row's menu and the inspector's. */
export function blockMenuItems({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}): MoreMenuItem[] {
  return [
    {
      label: "Move up",
      onSelect: () => onMove(index, index - 1),
      ...(index === 0 && { disabledReason: "It's the first." }),
    },
    {
      label: "Move down",
      onSelect: () => onMove(index, index + 1),
      ...(index === count - 1 && { disabledReason: "It's the last." }),
    },
    { label: "Remove", destructive: true, onSelect: onRemove },
  ];
}

export type NavigatorActions = {
  select: (selection: OutputSelection) => void;
  addDisplayBlock: (params: {
    viewId: string;
    kind: OutputDisplayBlockKind;
  }) => void;
  addOutputBlock: (viewId: string) => void;
  setBlocks: (params: { viewId: string; blocks: OutputBlock[] }) => void;
  removeBlock: (params: { viewId: string; index: number }) => void;
};

/** "All output views", then each view with its blocks and an Add block menu. */
export function OutputNavigator({
  views,
  outputFields,
  selection,
  actions,
}: {
  views: readonly OutputViewSchema[];
  outputFields: AnyField[];
  selection: OutputSelection;
  actions: NavigatorActions;
}) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <button
        type="button"
        aria-current={selection.target === OutputTarget.All || undefined}
        onClick={() =>
          actions.select({
            target: OutputTarget.All,
            viewId: selection.viewId,
          })
        }
        className={cn(
          ROW,
          "font-medium",
          selection.target === OutputTarget.All && SELECTED,
        )}
      >
        All output views
      </button>
      {views.map((view) => (
        <ViewTree
          key={view.id}
          view={view}
          outputFields={outputFields}
          selection={selection}
          actions={actions}
        />
      ))}
    </div>
  );
}

function ViewTree({
  view,
  outputFields,
  selection,
  actions,
}: {
  view: OutputViewSchema;
  outputFields: AnyField[];
  selection: OutputSelection;
  actions: NavigatorActions;
}) {
  const fieldLookup = useMemo(
    () => new Map(outputFields.map((field) => [field.id, field])),
    [outputFields],
  );
  const setBlocks = (blocks: OutputBlock[]) =>
    actions.setBlocks({ viewId: view.id, blocks });
  const drag = useDragReorder(view.blocks, setBlocks);
  const viewSelected =
    selection.target === OutputTarget.View && selection.viewId === view.id;
  const move = (from: number, to: number) => {
    const next = [...view.blocks];
    const [block] = next.splice(from, 1);
    next.splice(to, 0, block);
    setBlocks(next);
  };

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <button
        type="button"
        aria-current={viewSelected || undefined}
        onClick={() =>
          actions.select({ target: OutputTarget.View, viewId: view.id })
        }
        className={cn(ROW, "font-medium", viewSelected && SELECTED)}
      >
        <span className="truncate">{view.title || "Untitled view"}</span>
      </button>
      <ul
        ref={drag.listRef}
        aria-label={`Blocks of ${view.title || "Untitled view"}`}
        onDragOver={drag.handleListDragOver}
        onDrop={drag.handleListDrop}
        className="ml-3 flex flex-col gap-0.5 border-l border-line pl-1"
      >
        {view.blocks.map((block, index) => {
          if ("kind" in block && !OUTPUT_BY_KIND[block.kind]) {
            throw new Error(`output views can't show ${block.kind} blocks`);
          }
          const key = outputBlockKey(block, index);
          const selected =
            selection.target === OutputTarget.Block &&
            selection.viewId === view.id &&
            selection.blockKey === key;
          const label = outputBlockInternalDescriptor({ block, fieldLookup });
          const showBar =
            drag.dragOverIndex === index &&
            drag.dropPosition !== null &&
            drag.draggedIndex !== null;
          return (
            <li
              key={key}
              onDragOver={drag.handleDragOver(index)}
              onDrop={drag.handleDrop(index)}
              className={cn(
                "relative flex items-center gap-1",
                drag.draggedIndex === index && "opacity-50",
              )}
            >
              {showBar && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-accent",
                    drag.dropPosition === DropPosition.Before
                      ? "-top-px"
                      : "-bottom-px",
                  )}
                />
              )}
              <span
                draggable
                title="Drag to reorder"
                onDragStart={drag.handleDragStart(index)}
                onDragEnd={drag.handleDragEnd}
                className="cursor-grab px-0.5 text-fg-muted"
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </span>
              <button
                type="button"
                aria-current={selected || undefined}
                onClick={() =>
                  actions.select({
                    target: OutputTarget.Block,
                    viewId: view.id,
                    blockKey: key,
                  })
                }
                title={label}
                className={cn(ROW, "min-w-0 flex-1 py-1", selected && SELECTED)}
              >
                <span className="min-w-0">
                  <span className="block truncate">{label}</span>
                  <span className="block truncate font-mono text-xs text-fg-muted">
                    {block.id}
                  </span>
                </span>
              </button>
              <MoreMenu
                size="small"
                compact
                subject={label}
                items={blockMenuItems({
                  index,
                  count: view.blocks.length,
                  onMove: move,
                  onRemove: () =>
                    actions.removeBlock({ viewId: view.id, index }),
                })}
              />
            </li>
          );
        })}
      </ul>
      <div className="ml-3 pl-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Add block to ${view.title || "Untitled view"}`}
            className={cn(
              "inline-flex",
              buttonVariants({ variant: ButtonVariant.Ghost, size: "small" }),
            )}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add block
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-48">
            {DISPLAY_BLOCK_KINDS.map((kind) => (
              <DropdownMenuItem
                key={kind}
                label={DISPLAY_KIND_LABELS[kind]}
                onClick={() =>
                  actions.addDisplayBlock({ viewId: view.id, kind })
                }
              >
                {DISPLAY_KIND_LABELS[kind]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              label="Output field block"
              disabled={outputFields.length === 0}
              onClick={() => actions.addOutputBlock(view.id)}
              className={cn(
                outputFields.length === 0 &&
                  "flex-col items-start data-disabled:opacity-100",
              )}
            >
              {outputFields.length === 0 ? (
                <>
                  <span className="opacity-50">Output field block</span>
                  <span className="text-caption text-fg-muted">
                    Mark questions as output fields first
                  </span>
                </>
              ) : (
                "Output field block"
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
