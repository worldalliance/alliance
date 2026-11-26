import {
  type DisplayBlock,
  type ManualDisplayBlockContent,
} from "@alliance/common/forms/display-blocks";
import { type AnyField } from "@alliance/common/forms/form-schema";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { withBlockVisibility } from "../../../../lib/blockVisibility";
import type { AddressedWrite } from "../../../../lib/displayBlockById";
import { InspectorGroup } from "../kit/InspectorGroup";
import Button, { ButtonVariant } from "../../../../ui/Button";
import {
  SectionPanels,
  useSidebarSections,
} from "../inspector/sidebarSections";
import type { OutputBlockOption } from "../conditions/ContextRules";
import { ElementConditions } from "../conditions/VisibilityConditions";
import { BlockPreviewAllowed } from "./BlockPreview";
import { ManualUserList } from "./ManualUserList";
import {
  landingIn,
  writeBlockFor,
  type BlockWriteLanding,
  type LandingFor,
} from "./perUserContent";
import { PerUserOptions } from "./PerUserOptions";
import { usePerViewerOptionsAllowed } from "./PerViewerOptionsContext";
import { StackedBlockCard } from "./StackedBlockCard";
import { useClipboardImport } from "./useClipboardImport";
import {
  useManualTargets,
  type ManualTargets,
  type TargetLabel,
} from "./useManualTargets";

type DisplayBlockChildRenderProps<T extends DisplayBlock> = {
  block: T;
  onUpdate: (updates: Partial<T>) => void;
  /**
   * Write to one user's override rather than whichever is on screen now, for
   * work started under a target the admin can navigate away from before it
   * lands. `current` is that target's block, resolved when the write happens.
   */
  updateFor: (
    userId: string | null,
    update: (current: T) => Partial<T>,
  ) => BlockWriteLanding;
  /** Where a write for `userId` would land, for work that has none to make. */
  landingFor: LandingFor;
  activeUserId?: string | null;
  targetLabel: TargetLabel;
  isDefaultContent: boolean;
  hasContentForUser: boolean;
  /** Writes the default content and every user's content alike. */
  updateBlockWide: (updates: Partial<T>) => void;
};

interface DisplayBlockWrapperProps<T extends DisplayBlock = DisplayBlock> {
  /** Inspector groups (`InspectorGroup`), which the wrapper stacks. */
  children: ReactNode | ((props: DisplayBlockChildRenderProps<T>) => ReactNode);
  onRemove: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  block?: T;
  onUpdate?: (updates: Partial<T>) => void;
  updateCurrent?: AddressedWrite;
  previousFields?: AnyField[];
  laterFields?: AnyField[];
  outputBlocks?: OutputBlockOption[];
  /** A container block's content lives in its children, so it has none to override. */
  perUserContent?: boolean;
}

/**
 * A display block's editor: its Content and Conditions panels in the
 * inspector, or both stacked in a card where no inspector holds it.
 */
export function DisplayBlockWrapper<T extends DisplayBlock = DisplayBlock>({
  children,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  block,
  onUpdate,
  updateCurrent,
  previousFields,
  laterFields,
  outputBlocks,
  perUserContent = true,
}: DisplayBlockWrapperProps<T>) {
  const perViewerOptionsAllowed = usePerViewerOptionsAllowed();
  const sidebar = useSidebarSections();
  const showConditional = Boolean(block && onUpdate && perViewerOptionsAllowed);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const targets = useManualTargets(block);
  const { manualPerUserEnabled, activeManualUserId, hasContentForActiveUser } =
    targets;

  const effectiveBlock = useMemo(() => {
    if (!block) return block;
    if (manualPerUserEnabled && activeManualUserId) {
      return resolveDisplayBlockForUser(block, activeManualUserId);
    }
    return block;
  }, [activeManualUserId, block, manualPerUserEnabled]);

  const updateBlockWide = (updates: Partial<T>) => {
    if (!onUpdate || !block) return;
    if (
      block.manualUserContent &&
      Object.keys(block.manualUserContent).length
    ) {
      const nextManualContent: Record<string, ManualDisplayBlockContent> =
        Object.fromEntries(
          Object.entries(block.manualUserContent).map(([userId, content]) => [
            userId,
            { ...content, ...updates },
          ]),
        );
      // `manualUserContent` exists on every display block kind, so it fits any `T`.
      onUpdate({
        ...updates,
        manualUserContent: nextManualContent,
      } as Partial<T>);
      return;
    }
    onUpdate(updates);
  };

  const handleConditionalChange = (updates: {
    visibleIfFormula?: VisibleIfFormula;
  }) => {
    if (!onUpdate || !block) return;
    const next = withBlockVisibility(block, updates.visibleIfFormula);
    // Both keys exist on every display block kind, so they fit any `T`.
    onUpdate({
      visibleIfFormula: next.visibleIfFormula,
      manualUserContent: next.manualUserContent,
    } as Partial<T>);
  };

  const updateBlockFor = useCallback(
    (
      userId: string | null,
      update: (current: T) => Partial<T>,
    ): BlockWriteLanding =>
      block
        ? writeBlockFor({ block, userId, update, updateCurrent, onUpdate })
        : null,
    [block, onUpdate, updateCurrent],
  );

  const landingFor = useCallback<LandingFor>(
    (userId) => landingIn(block, userId),
    [block],
  );

  const handleBlockUpdate = useCallback(
    (updates: Partial<T>) => updateBlockFor(activeManualUserId, () => updates),
    [activeManualUserId, updateBlockFor],
  );

  const importFromClipboard = useClipboardImport({
    block,
    onUpdate,
    updateCurrent,
    closeMenu: () => setOptionsOpen(false),
  });

  const shownBlock = effectiveBlock ?? block;
  const editorContent =
    typeof children === "function"
      ? shownBlock &&
        children({
          block: shownBlock,
          onUpdate: handleBlockUpdate,
          updateFor: updateBlockFor,
          landingFor,
          activeUserId: activeManualUserId,
          targetLabel: targets.targetLabel,
          isDefaultContent: !manualPerUserEnabled || !activeManualUserId,
          hasContentForUser: hasContentForActiveUser,
          updateBlockWide,
        })
      : children;

  const perUserOptions = perUserContent && block && onUpdate && (
    <PerUserOptions
      block={block}
      onUpdate={onUpdate}
      onImport={importFromClipboard}
      targets={targets}
    />
  );
  const status = manualPerUserEnabled && <PerUserStatus targets={targets} />;
  const fields = (
    <BlockPreviewAllowed.Provider value={!sidebar}>
      {editorContent}
    </BlockPreviewAllowed.Provider>
  );
  const userList = manualPerUserEnabled && onUpdate && (
    <ManualUserList targets={targets} />
  );
  const conditionsProps = shownBlock && {
    field: shownBlock,
    previousFields: previousFields ?? [],
    laterFields,
    outputBlocks,
    onChange: handleConditionalChange,
  };

  if (sidebar) {
    return (
      <SectionPanels
        content={
          <>
            {fields}
            {showConditional && perUserOptions && (
              <InspectorGroup title="Per-user content">
                {perUserOptions}
                {status}
                {userList}
              </InspectorGroup>
            )}
          </>
        }
        conditions={
          showConditional &&
          conditionsProps && <ElementConditions {...conditionsProps} />
        }
      />
    );
  }

  return (
    <StackedBlockCard
      blockId={block?.id}
      onRemove={onRemove}
      drag={onDragStart ? { onDragStart, onDragEnd } : undefined}
      isDragging={isDragging}
      options={
        showConditional && conditionsProps
          ? {
              open: optionsOpen,
              onOpenChange: setOptionsOpen,
              perUserOptions,
              conditions: conditionsProps,
            }
          : null
      }
    >
      {status}
      {fields}
      {userList}
    </StackedBlockCard>
  );
}

/** Whose content the fields below hold, and stepping through the members. */
function PerUserStatus({ targets }: { targets: ManualTargets }) {
  const {
    activeManualUserId,
    hasContentForActiveUser,
    targetLabel,
    paginationLabel,
    totalManualTargets,
    handleCycleUser,
  } = targets;
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <p className="truncate font-semibold">
          {activeManualUserId
            ? `Editing content for ${targetLabel(activeManualUserId)}`
            : "Editing default content"}
        </p>
        <p className="text-caption text-fg-muted">
          {hasContentForActiveUser
            ? "Custom content saved for this user."
            : "Using the default content."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="px-1 text-caption text-fg-muted tabular-nums">
          {paginationLabel}
        </span>
        <Button
          variant={ButtonVariant.Default}
          size="small"
          onClick={() => handleCycleUser("prev")}
          disabled={totalManualTargets === 0}
        >
          Previous
        </Button>
        <Button
          variant={ButtonVariant.Default}
          size="small"
          onClick={() => handleCycleUser("next")}
          disabled={totalManualTargets === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
