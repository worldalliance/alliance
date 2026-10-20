import {
  type DisplayBlock,
  type ManualDisplayBlockContent,
} from "@alliance/common/forms/display-blocks";
import { type AnyField } from "@alliance/common/forms/form-schema";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { cn } from "@alliance/shared/styles/util";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { withBlockVisibility } from "../../lib/blockVisibility";
import type { AddressedWrite } from "../../lib/displayBlockById";
import {
  SectionPanels,
  useSidebarSections,
} from "../form-canvas/sidebarSections";
import { ConditionalVisibility } from "../form-fields/conditions/ConditionalVisibility";
import type { OutputBlockOption } from "../form-fields/conditions/ContextRules";
import { useTypedExpression } from "../form-fields/conditions/expressionBuffers";
import { ElementConditions } from "../form-fields/conditions/VisibilityConditions";
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
import { useClipboardImport } from "./useClipboardImport";
import { useManualTargets, type TargetLabel } from "./useManualTargets";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const expression = useTypedExpression(block ?? {});
  const [
    showConditionalVisibilityControl,
    setShowConditionalVisibilityControl,
  ] = useState<boolean>(() => {
    if (!block) return false;
    return expression.typed || block.visibleIfFormula !== undefined;
  });

  const targets = useManualTargets(block);
  const {
    manualPerUserEnabled,
    activeManualUserId,
    totalManualTargets,
    paginationLabel,
    hasContentForActiveUser,
    targetLabel,
    handleCycleUser,
  } = targets;
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current?.contains(event.target as Node)) return;
      setIsMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (
      block?.visibleIfFormula !== undefined &&
      !showConditionalVisibilityControl
    ) {
      setShowConditionalVisibilityControl(true);
    }
  }, [block, showConditionalVisibilityControl]);

  const effectiveBlock = useMemo(() => {
    if (!block) return block;
    if (manualPerUserEnabled && activeManualUserId) {
      return resolveDisplayBlockForUser(block, activeManualUserId);
    }
    return block;
  }, [activeManualUserId, block, manualPerUserEnabled]);

  const updateBlockWide = (updates: Partial<T>) => {
    if (!onUpdate || !block) {
      return;
    }
    if (
      block.manualUserContent &&
      Object.keys(block.manualUserContent).length
    ) {
      const nextManualContent = Object.fromEntries(
        Object.entries(block.manualUserContent).map(([userId, content]) => [
          userId,
          { ...content, ...updates },
        ]),
      ) as Record<string, ManualDisplayBlockContent>;
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

  const handleConditionalVisibilityToggle = (checked: boolean) => {
    setShowConditionalVisibilityControl(checked);
    if (!checked) {
      handleConditionalChange({
        visibleIfFormula: undefined,
      });
      expression.clear();
    }
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

  const showConditionalControls =
    showConditionalVisibilityControl && showConditional;

  const editorContent =
    typeof children === "function"
      ? children({
          block: (effectiveBlock ?? (block as T)) as T,
          onUpdate: handleBlockUpdate,
          updateFor: updateBlockFor,
          landingFor,
          activeUserId: activeManualUserId,
          targetLabel,
          isDefaultContent: !manualPerUserEnabled || !activeManualUserId,
          hasContentForUser: hasContentForActiveUser,
          updateBlockWide,
        })
      : children;
  const renderContent = (
    <BlockPreviewAllowed.Provider value={!sidebar}>
      {editorContent}
    </BlockPreviewAllowed.Provider>
  );

  const importFromClipboard = useClipboardImport({
    block,
    onUpdate,
    updateCurrent,
    closeMenu: () => setIsMenuOpen(false),
  });
  const perUserOptions = perUserContent && block && onUpdate && (
    <PerUserOptions
      block={block}
      onUpdate={onUpdate}
      onImport={importFromClipboard}
      targets={targets}
    />
  );
  const contentBody = (
    <>
      {manualPerUserEnabled && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <div>
            <p className="text-sm font-semibold">
              {activeManualUserId
                ? `Editing content for ${targetLabel(activeManualUserId)}`
                : "Editing default content"}
            </p>
            <p className="text-xs">
              {hasContentForActiveUser
                ? "Custom content saved for this user."
                : "Currently using the default block content."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-white px-2 py-1 text-[11px] text-gray-700">
              {paginationLabel}
            </span>
            <button
              type="button"
              className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-1 hover:border-gray-300 disabled:opacity-50"
              onClick={() => handleCycleUser("prev")}
              disabled={totalManualTargets === 0}
            >
              Prev
            </button>
            <button
              type="button"
              className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-1 hover:border-gray-300 disabled:opacity-50"
              onClick={() => handleCycleUser("next")}
              disabled={totalManualTargets === 0}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {renderContent}
      {manualPerUserEnabled && onUpdate && <ManualUserList targets={targets} />}
    </>
  );

  if (sidebar) {
    return (
      <SectionPanels
        content={
          <div className="space-y-3">
            {showConditional && perUserOptions && (
              <div className="rounded-md border border-gray-200 py-2 text-sm">
                {perUserOptions}
              </div>
            )}
            {contentBody}
          </div>
        }
        conditions={
          showConditional && (
            <ElementConditions
              field={effectiveBlock ?? block!}
              previousFields={previousFields || []}
              laterFields={laterFields}
              outputBlocks={outputBlocks}
              onChange={handleConditionalChange}
            />
          )
        }
      />
    );
  }

  return (
    <div
      className={cn(
        "group relative border rounded-lg p-4 pl-8 pt-8 transition-all",
        isDragging
          ? "border-blue-400 shadow-lg opacity-50"
          : "border-gray-200 hover:border-gray-300",
      )}
    >
      {onDragStart && (
        <div
          className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
        >
          <div
            className="text-gray-400 hover:text-gray-600 p-1"
            style={{ userSelect: "none" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              style={{ userSelect: "none" }}
            >
              <circle cx="2" cy="2" r="1" />
              <circle cx="6" cy="2" r="1" />
              <circle cx="2" cy="6" r="1" />
              <circle cx="6" cy="6" r="1" />
              <circle cx="2" cy="10" r="1" />
              <circle cx="6" cy="10" r="1" />
            </svg>
          </div>
        </div>
      )}
      {block?.id && (
        <span
          className="absolute top-2 left-8 font-mono text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded select-all"
          title="Block id"
        >
          {block.id}
        </span>
      )}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {showConditional && (
          <div className="relative" ref={optionsMenuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="text-gray-500 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Display block options</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="3.5" cy="8" r="1.2" />
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="12.5" cy="8" r="1.2" />
              </svg>
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg z-20">
                <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={showConditionalVisibilityControl}
                    onChange={(event) =>
                      handleConditionalVisibilityToggle(event.target.checked)
                    }
                  />
                  Use conditional visibility
                </label>
                {perUserOptions && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    {perUserOptions}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50"
          title="Remove field"
        >
          ×
        </button>
      </div>
      <div className={cn(showConditionalControls && "space-y-3")}>
        {contentBody}
        {showConditionalControls && (
          <div className="border-t border-gray-200 pt-4">
            <ConditionalVisibility
              field={effectiveBlock ?? block!}
              previousFields={previousFields || []}
              laterFields={laterFields}
              outputBlocks={outputBlocks}
              onChange={handleConditionalChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
