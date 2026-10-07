import type { AnyField, Page } from "@alliance/common/forms/form-schema";
import { Copy, FileJson, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ExpressionScope } from "../form-fields/conditions/expressionBuffers";
import { VisibilityConditions } from "../form-fields/conditions/VisibilityConditions";
import {
  SettingsAction,
  SettingsActions,
  SettingsMoveActions,
} from "./SettingsActions";
import { SettingsSidebar } from "./SettingsSidebar";
import { ALL_SECTIONS, SectionPanels, SidebarSection } from "./sidebarSections";

/** The selected page's settings, around its editor. */
export function PageSettingsSidebar({
  pageId,
  section,
  onSection,
  focusPending,
  onFocused,
  onMoveUp,
  onMoveDown,
  onEditJson,
  onCopy,
  onDelete,
  children,
}: {
  pageId: string;
  section: SidebarSection;
  onSection: (section: SidebarSection) => void;
  focusPending: boolean;
  onFocused: () => void;
  /** Null where the page can't move that way. */
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  onEditJson: () => void;
  onCopy: () => void;
  /** Null where the page can't be deleted. */
  onDelete: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <SettingsSidebar
      heading="Page settings"
      headingActions={
        <SettingsMoveActions
          noun="page"
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      }
      sections={ALL_SECTIONS}
      section={section}
      onSection={onSection}
      focusPending={focusPending}
      onFocused={onFocused}
      actions={
        <SettingsActions idLabel="Page ID" id={pageId}>
          <SettingsAction Icon={FileJson} onClick={onEditJson}>
            Edit page JSON
          </SettingsAction>
          <SettingsAction Icon={Copy} onClick={onCopy}>
            Copy page
          </SettingsAction>
          <SettingsAction
            Icon={Trash2}
            destructive
            disabled={!onDelete}
            onClick={() => onDelete?.()}
          >
            Delete page
          </SettingsAction>
        </SettingsActions>
      }
    >
      {children}
    </SettingsSidebar>
  );
}

/** Key by page id, so an editor's local state belongs to one page. */
export function PageSettings({
  page,
  isFirstPage,
  previousFields,
  onUpdate,
}: {
  page: Page;
  isFirstPage: boolean;
  previousFields: AnyField[];
  onUpdate: (updates: Partial<Page>) => void;
}) {
  return (
    <SectionPanels
      content={
        <label className="block text-xs font-medium text-gray-700">
          Page title
          <input
            type="text"
            value={page.title ?? ""}
            onChange={(event) => onUpdate({ title: event.target.value })}
            placeholder="Page title"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      }
      conditions={
        <ExpressionScope.Provider value={`page:${page.id}`}>
          {isFirstPage && (
            <p className="text-xs text-amber-600">
              Conditions on the first page can only reference other forms or
              validators, since no fields have been answered yet.
            </p>
          )}
          <VisibilityConditions
            field={page}
            previousFields={previousFields}
            onChange={({ visibleIfFormula }) => onUpdate({ visibleIfFormula })}
          />
        </ExpressionScope.Provider>
      }
    />
  );
}
