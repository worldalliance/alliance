import { ChevronLeft } from "lucide-react";
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
  parent,
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
  parent?: { label: string; onSelect: () => void };
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
      {parent && (
        <button
          type="button"
          onClick={parent.onSelect}
          aria-label={`Back to ${parent.label}`}
          title={`Back to ${parent.label}`}
          className="mx-2 mt-2 flex max-w-full items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{parent.label}</span>
        </button>
      )}
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
