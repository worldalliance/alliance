import type { AnyField, Page } from "@alliance/common/forms/form-schema";
import type { ReactNode } from "react";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { ReadOnlyId } from "../../pages/forms/builder/kit/ReadOnlyId";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Field } from "../../ui/templates/Form";
import {
  ExpressionScope,
  expressionKeys,
} from "../form-fields/conditions/expressionBuffers";
import { VisibilityConditions } from "../form-fields/conditions/VisibilityConditions";
import { SettingsSidebar } from "./SettingsSidebar";
import { ALL_SECTIONS, SectionPanels, SidebarSection } from "./sidebarSections";

/**
 * The selected page's settings, around its editor. Moving, copying and
 * deleting the page are in the header's More menu.
 */
export function PageSettingsSidebar({
  pageId,
  section,
  onSection,
  focusPending,
  onFocused,
  onEditJson,
  dependencies,
  children,
}: {
  pageId: string;
  section: SidebarSection;
  onSection: (section: SidebarSection) => void;
  focusPending: boolean;
  onFocused: () => void;
  /** BACKCOMPAT(builder-page-actions): unused since the More menu offers them; Z drops them from FormBuilderSettings. */
  onMoveUp?: (() => void) | null;
  onMoveDown?: (() => void) | null;
  onCopy?: () => void;
  onDelete?: (() => void) | null;
  onEditJson: () => void;
  dependencies: ReactNode;
  children: ReactNode;
}) {
  return (
    <SettingsSidebar
      heading="Page settings"
      sections={ALL_SECTIONS}
      section={section}
      onSection={onSection}
      focusPending={focusPending}
      onFocused={onFocused}
      dependencies={dependencies}
      actions={
        <InspectorGroup>
          <ReadOnlyId label="Page ID" value={pageId} />
          <div>
            <Button
              variant={ButtonVariant.Default}
              size="small"
              onClick={onEditJson}
            >
              Edit page JSON…
            </Button>
          </div>
        </InspectorGroup>
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
        <Field label="Page title">
          {(control) => (
            <Input
              {...control}
              value={page.title ?? ""}
              onChange={(event) => onUpdate({ title: event.target.value })}
              placeholder="Page title"
            />
          )}
        </Field>
      }
      conditions={
        <ExpressionScope.Provider value={expressionKeys.page(page.id)}>
          {isFirstPage && (
            <p className="text-caption text-fg-muted">
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
