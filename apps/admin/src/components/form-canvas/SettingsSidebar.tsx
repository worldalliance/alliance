import { useEffect, useRef, type ReactNode } from "react";
import { SidebarSection, SidebarSections } from "./sidebarSections";

const EDITING_CONTROL =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';

/**
 * The selected item's settings under a heading. While `focusPending`, focuses
 * the first editing control of the active section, as after inserting an
 * element, whether the sidebar was already showing or appeared with it.
 */
export function SettingsSidebar({
  heading,
  headingActions,
  sections,
  section,
  onSection,
  actions,
  focusPending,
  onFocused,
  children,
}: {
  heading: string;
  headingActions?: ReactNode;
  sections: readonly SidebarSection[];
  section: SidebarSection;
  onSection: (section: SidebarSection) => void;
  actions?: ReactNode;
  focusPending: boolean;
  onFocused: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusPending) return;
    ref.current
      ?.querySelector('[role="tabpanel"]:not([hidden])')
      ?.querySelector<HTMLElement>(EDITING_CONTROL)
      ?.focus();
    onFocused();
  }, [focusPending, onFocused]);

  return (
    <div ref={ref}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-gray-900">
          {heading}
        </h2>
        {headingActions && (
          <div className="flex shrink-0 items-center gap-1">
            {headingActions}
          </div>
        )}
      </div>
      <SidebarSections
        sections={sections}
        active={sections.includes(section) ? section : sections[0]!}
        onSelect={onSection}
        actions={actions}
      >
        {children}
      </SidebarSections>
    </div>
  );
}
