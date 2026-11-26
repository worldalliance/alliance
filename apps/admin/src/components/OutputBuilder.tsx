import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { outputBlockInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type {
  AnyField,
  FormSchema,
  OutputBlock,
  OutputFieldBlock,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addressedWrite, type BlockWriteById } from "../lib/displayBlockById";
import { HEADER_TRUNCATES } from "../pages/forms/builder/paneHeader";
import Button, { ButtonVariant } from "../ui/Button";
import { cn } from "../ui/cn";
import { EmptyState } from "../ui/EmptyState";
import { MoreMenu } from "../ui/MoreMenu";
import { PaneHeader, Workspace } from "../ui/templates/Workspace";
import { createDisplayBlock } from "./display-blocks";
import { renderBlockEditor } from "./display-blocks/blockEditors";
import { SidebarSection, SidebarSections } from "./form-canvas/sidebarSections";
import {
  ElementExpressionScope,
  expressionKeys,
} from "./form-fields/conditions/expressionBuffers";
import { EditableOutputFieldBlock } from "./output-builder/EditableOutputFieldBlock";
import {
  AllViewsInspector,
  ViewInspector,
} from "./output-builder/OutputInspector";
import {
  OutputNavigator,
  blockMenuItems,
  type NavigatorActions,
} from "./output-builder/OutputNavigator";
import { OutputPreview } from "./output-builder/OutputPreview";
import {
  OutputTarget,
  outputBlockKey,
  type OutputSelection,
} from "./output-builder/outputSelection";

const BLOCK_SECTIONS = [SidebarSection.Content, SidebarSection.Conditions];

/** A pane's own scroller under its header, so nothing but the pane scrolls. */
const PANE_SCROLL = "min-h-0 flex-1 overflow-x-hidden overflow-y-auto";

const collectOutputFields = (schema: FormSchema): AnyField[] => {
  const result: AnyField[] = [];
  schema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if (field.type === "input" && field.output?.output) result.push(field);
    });
  });
  return result;
};

// The editors send updates of their own block's variant, so the merge stays in it.
const mergeBlock = (block: OutputBlock, updates: Partial<OutputBlock>) =>
  ({ ...block, ...updates }) as OutputBlock;

const uniqueId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const buildNewView = (schema: FormSchema): OutputViewSchema => ({
  id: uniqueId("output-view"),
  type: "default",
  title: `View ${((schema.outputViews ?? []).length || 0) + 1}`,
  description: "",
  blocks: [],
});

interface OutputBuilderProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
  /** Owned by the builder above, which outlives a view switch. */
  onUpdateBlockById: BlockWriteById;
  /** Remounts the block editors when it changes, as after undo. */
  editorsKey: number;
  /** Null, or a view that's gone, shows the first view. */
  selectedViewId: string | null;
  onSelectView: (viewId: string | null) => void;
  /** The builder's toolbar, above the three panes. */
  toolbar?: ReactNode;
  /** The canvas pane's header for a title. */
  header?: (title: string) => ReactNode;
}

/**
 * The Output views tab: views and their blocks in the navigator, the selected
 * view previewed with sample answers, and the selection's settings beside it.
 */
export function OutputBuilder({
  schema,
  onSchemaChange,
  onUpdateBlockById,
  editorsKey,
  selectedViewId,
  onSelectView,
  toolbar,
  header,
}: OutputBuilderProps) {
  const views = useMemo(() => schema.outputViews ?? [], [schema.outputViews]);
  const outputFields = useMemo(() => collectOutputFields(schema), [schema]);
  const selectedView: OutputViewSchema | null =
    views.find((view) => view.id === selectedViewId) ?? views[0] ?? null;
  const activeViewId = selectedView?.id ?? null;

  useEffect(() => {
    if (activeViewId !== selectedViewId) onSelectView(activeViewId);
  }, [activeViewId, selectedViewId, onSelectView]);

  // A view already chosen on arrival, as by an issue's link, opens its settings.
  const [chosen, setChosen] = useState<OutputSelection>(() =>
    selectedViewId !== null && activeViewId !== null
      ? { target: OutputTarget.View, viewId: activeViewId }
      : { target: OutputTarget.All, viewId: activeViewId },
  );
  const selection = useMemo<OutputSelection>(() => {
    if (chosen.viewId !== activeViewId) {
      return activeViewId === null
        ? { target: OutputTarget.All, viewId: null }
        : { target: OutputTarget.View, viewId: activeViewId };
    }
    if (chosen.target === OutputTarget.Block) {
      const present = selectedView?.blocks.some(
        (block, index) => outputBlockKey(block, index) === chosen.blockKey,
      );
      if (!present) return { target: OutputTarget.View, viewId: chosen.viewId };
    }
    return chosen;
  }, [chosen, activeViewId, selectedView]);

  const select = (next: OutputSelection) => {
    setChosen(next);
    if (next.viewId !== null) onSelectView(next.viewId);
  };

  const updateViews = (next: OutputViewSchema[]) =>
    onSchemaChange({ ...schema, outputViews: next });
  const updateView = (viewId: string, updates: Partial<OutputViewSchema>) =>
    updateViews(
      views.map((view) =>
        view.id === viewId ? { ...view, ...updates } : view,
      ),
    );

  const addView = () => {
    const view = buildNewView(schema);
    updateViews([...views, view]);
    select({ target: OutputTarget.View, viewId: view.id });
  };

  const removeView = (viewId: string) => {
    updateViews(views.filter((view) => view.id !== viewId));
    select({
      target: OutputTarget.All,
      viewId: views.find((view) => view.id !== viewId)?.id ?? null,
    });
  };

  const appendBlock = (params: { viewId: string; block: OutputBlock }) => {
    const view = views.find((candidate) => candidate.id === params.viewId);
    if (!view) return;
    updateView(view.id, { blocks: [...view.blocks, params.block] });
    select({
      target: OutputTarget.Block,
      viewId: view.id,
      blockKey: outputBlockKey(params.block, view.blocks.length),
    });
  };

  const actions: NavigatorActions = {
    select,
    addDisplayBlock: ({ viewId, kind }) =>
      appendBlock({
        viewId,
        block: createDisplayBlock(kind, uniqueId("block")),
      }),
    addOutputBlock: (viewId) => {
      const [first] = outputFields;
      if (!first) return;
      appendBlock({
        viewId,
        block: {
          id: uniqueId("output-field"),
          fieldId: first.id,
          showLabel: true,
          format: "field",
        },
      });
    },
    setBlocks: ({ viewId, blocks }) => updateView(viewId, { blocks }),
    removeBlock: ({ viewId, index }) => {
      const view = views.find((candidate) => candidate.id === viewId);
      if (!view) return;
      updateView(viewId, {
        blocks: view.blocks.filter((_, position) => position !== index),
      });
      select({ target: OutputTarget.View, viewId });
    },
  };

  const previewTitle = selectedView
    ? `Preview of ${selectedView.title || "Untitled view"}`
    : "Preview";

  return (
    <Workspace
      toolbar={toolbar}
      navigator={
        <nav aria-label="Output views" className="flex min-h-0 flex-1 flex-col">
          <PaneHeader
            title="Output views"
            action={
              <Button
                variant={ButtonVariant.Default}
                size="small"
                onClick={addView}
              >
                Add output view
              </Button>
            }
          />
          <div className={PANE_SCROLL}>
            <OutputNavigator
              views={views}
              outputFields={outputFields}
              selection={selection}
              actions={actions}
            />
          </div>
        </nav>
      }
      inspector={
        <aside
          aria-label="Output view settings"
          className="flex min-h-0 flex-1 flex-col"
        >
          <InspectorPane
            key={`${selection.target}:${selection.viewId}:${selection.target === OutputTarget.Block ? selection.blockKey : ""}`}
            schema={schema}
            onSchemaChange={onSchemaChange}
            views={views}
            outputFields={outputFields}
            selection={selection}
            editorsKey={editorsKey}
            onUpdateBlockById={onUpdateBlockById}
            updateView={updateView}
            removeView={removeView}
            actions={actions}
          />
        </aside>
      }
    >
      {header ? header(previewTitle) : <PaneHeader title={previewTitle} />}
      <div className={cn(PANE_SCROLL, "p-card")}>
        {selectedView ? (
          <OutputPreview
            schema={schema}
            view={selectedView}
            outputFields={outputFields}
          />
        ) : (
          <EmptyState
            title="No output views yet"
            description="An output view shows members' answers back to them once they finish."
            action={
              <Button variant={ButtonVariant.Primary} onClick={addView}>
                Add output view
              </Button>
            }
          />
        )}
      </div>
    </Workspace>
  );
}

/** The inspector's body for the selection; keyed by it so each selection starts on Content. */
function InspectorPane({
  schema,
  onSchemaChange,
  views,
  outputFields,
  selection,
  editorsKey,
  onUpdateBlockById,
  updateView,
  removeView,
  actions,
}: {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
  views: readonly OutputViewSchema[];
  outputFields: AnyField[];
  selection: OutputSelection;
  editorsKey: number;
  onUpdateBlockById: BlockWriteById;
  updateView: (viewId: string, updates: Partial<OutputViewSchema>) => void;
  removeView: (viewId: string) => void;
  actions: NavigatorActions;
}) {
  const [section, setSection] = useState(SidebarSection.Content);
  const scroller = useRef<HTMLDivElement>(null);
  const view =
    selection.viewId === null
      ? undefined
      : views.find((candidate) => candidate.id === selection.viewId);

  let body: ReactNode;
  if (selection.target === OutputTarget.View && view) {
    body = (
      <ViewInspector
        view={view}
        isLast={views.length <= 1}
        onUpdate={(updates) => updateView(view.id, updates)}
        onRemove={() => removeView(view.id)}
      />
    );
  } else if (selection.target === OutputTarget.Block && view) {
    const index = view.blocks.findIndex(
      (block, position) =>
        outputBlockKey(block, position) === selection.blockKey,
    );
    const block = view.blocks[index];
    if (block) {
      const fieldLookup = new Map(outputFields.map((f) => [f.id, f]));
      const outputBlocks = view.blocks
        .filter((b): b is OutputBlock & { id: string } => Boolean(b.id))
        .map((b) => ({
          id: b.id,
          label: outputBlockInternalDescriptor({
            block: b,
            fieldLookup,
            maxTextLength: 30,
          }),
        }));
      const update = (updates: Partial<OutputBlock>) =>
        actions.setBlocks({
          viewId: view.id,
          blocks: view.blocks.map((candidate, position) =>
            position === index ? mergeBlock(candidate, updates) : candidate,
          ),
        });
      const title = outputBlockInternalDescriptor({ block, fieldLookup });
      body = (
        <>
          <PaneHeader
            title={title}
            className={cn(HEADER_TRUNCATES, "z-20 bg-canvas")}
            action={
              <MoreMenu
                size="small"
                subject={title}
                items={blockMenuItems({
                  index,
                  count: view.blocks.length,
                  onMove: (from, to) => {
                    const next = [...view.blocks];
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    actions.setBlocks({ viewId: view.id, blocks: next });
                  },
                  onRemove: () =>
                    actions.removeBlock({ viewId: view.id, index }),
                })}
              />
            }
          />
          <SidebarSections
            sections={BLOCK_SECTIONS}
            active={section}
            onSelect={setSection}
          >
            <ElementExpressionScope
              parent={expressionKeys.outputView(view.id)}
              id={block.id}
            >
              {"kind" in block ? (
                <DisplayEditor
                  key={editorsKey}
                  block={block}
                  outputFields={outputFields}
                  outputBlocks={outputBlocks}
                  onUpdate={update}
                  onRemove={() =>
                    actions.removeBlock({ viewId: view.id, index })
                  }
                  onUpdateBlockById={onUpdateBlockById}
                />
              ) : (
                <EditableOutputFieldBlock
                  key={editorsKey}
                  block={block}
                  availableFields={outputFields}
                  outputBlocks={outputBlocks}
                  onUpdate={(updates: Partial<OutputFieldBlock>) =>
                    update(updates)
                  }
                />
              )}
            </ElementExpressionScope>
          </SidebarSections>
        </>
      );
    }
  }
  body ??= (
    <AllViewsInspector
      subtitle={schema.completionSubtitle}
      onSubtitle={(completionSubtitle) =>
        onSchemaChange({ ...schema, completionSubtitle })
      }
      outputFields={outputFields}
    />
  );
  return (
    <div ref={scroller} className={cn(PANE_SCROLL, "outline-none")}>
      {body}
    </div>
  );
}

function DisplayEditor({
  block,
  outputFields,
  outputBlocks,
  onUpdate,
  onRemove,
  onUpdateBlockById,
}: {
  block: DisplayBlock;
  outputFields: AnyField[];
  outputBlocks: { id: string; label: string }[];
  onUpdate: (updates: Partial<DisplayBlock>) => void;
  onRemove: () => void;
  onUpdateBlockById: BlockWriteById;
}) {
  return renderBlockEditor({
    block,
    onUpdate,
    updateCurrent: addressedWrite(block, onUpdateBlockById),
    onRemove,
    previousFields: outputFields,
    outputBlocks,
  });
}
