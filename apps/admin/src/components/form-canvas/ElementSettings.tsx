import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { ArrowDown, ArrowUp, Copy, FileJson, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  SettingsAction,
  SettingsActions,
  SettingsIconAction,
} from "./SettingsActions";
import { SettingsSidebar } from "./SettingsSidebar";
import { ALL_SECTIONS, SidebarSection } from "./sidebarSections";

const DISPLAY_ONLY_SECTIONS = [SidebarSection.Content, SidebarSection.Advanced];

/** The selected element's settings, around its editor. */
export function ElementSettings({
  element,
  displayOnly,
  section,
  onSection,
  focusPending,
  onFocused,
  onMoveUp,
  onMoveDown,
  onEditJson,
  onDuplicate,
  onDelete,
  children,
}: {
  element: PageItem;
  displayOnly: boolean;
  section: SidebarSection;
  onSection: (section: SidebarSection) => void;
  focusPending: boolean;
  onFocused: () => void;
  /** Null where the element can't move that way. */
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  onEditJson: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <SettingsSidebar
      heading={elementInternalDescriptor(element, {
        typeQualified: true,
        maxTextLength: 60,
      })}
      headingActions={
        <>
          <SettingsIconAction
            label="Move up"
            Icon={ArrowUp}
            disabled={!onMoveUp}
            onClick={() => onMoveUp?.()}
          />
          <SettingsIconAction
            label="Move down"
            Icon={ArrowDown}
            disabled={!onMoveDown}
            onClick={() => onMoveDown?.()}
          />
        </>
      }
      sections={displayOnly ? DISPLAY_ONLY_SECTIONS : ALL_SECTIONS}
      section={section}
      onSection={onSection}
      focusPending={focusPending}
      onFocused={onFocused}
      actions={
        <SettingsActions idLabel="Element ID" id={element.id}>
          <SettingsAction Icon={FileJson} onClick={onEditJson}>
            Edit element JSON
          </SettingsAction>
          <SettingsAction Icon={Copy} onClick={onDuplicate}>
            Duplicate
          </SettingsAction>
          <SettingsAction Icon={Trash2} destructive onClick={onDelete}>
            {isQuestionField(element) ? "Delete question" : "Delete block"}
          </SettingsAction>
        </SettingsActions>
      }
    >
      {children}
    </SettingsSidebar>
  );
}
