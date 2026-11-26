import type { PageItem } from "@alliance/common/forms/form-schema";
import type { ReactNode } from "react";
import { ReadOnlyId } from "../kit/ReadOnlyId";
import { describeHeading } from "../selection/canvasSelection";
import { SettingsSidebar } from "./SettingsSidebar";
import {
  ALL_SECTIONS,
  SidebarSection,
  UNCONDITIONAL_SECTIONS,
} from "./sidebarSections";

/**
 * The selected element's settings, around its editor. Its actions are in the
 * header's More menu; Advanced closes with its id.
 */
export function ElementSettings({
  element,
  displayOnly,
  section,
  onSection,
  focusPending,
  onFocused,
  layout,
  dependencies,
  children,
}: {
  element: PageItem;
  displayOnly: boolean;
  section: SidebarSection;
  onSection: (section: SidebarSection) => void;
  focusPending: boolean;
  onFocused: () => void;
  layout?: ReactNode;
  dependencies: ReactNode;
  children: ReactNode;
}) {
  return (
    <SettingsSidebar
      heading={describeHeading(element)}
      sections={displayOnly ? UNCONDITIONAL_SECTIONS : ALL_SECTIONS}
      section={section}
      onSection={onSection}
      focusPending={focusPending}
      onFocused={onFocused}
      dependencies={dependencies}
      layout={layout}
      actions={
        element.id && <ReadOnlyId label="Element ID" value={element.id} />
      }
    >
      {children}
    </SettingsSidebar>
  );
}
