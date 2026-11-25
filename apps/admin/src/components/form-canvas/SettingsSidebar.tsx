import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { InspectorHeader } from "../../pages/forms/builder/inspector/InspectorHeader";
import { focusInPlace } from "../../pages/forms/builder/kit/revealInPane";
import Button, { ButtonVariant } from "../../ui/Button";
import { SidebarSection, SidebarSections } from "./sidebarSections";

const EDITING_CONTROL =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';

/**
 * The selected item's settings under its header. While `focusPending`,
 * focuses the first editing control of the active section, as after inserting
 * an element, whether the inspector already showed it or not.
 */
export function SettingsSidebar({
  parent,
  heading,
  headingActions,
  sections,
  section,
  onSection,
  layout,
  actions,
  dependencies,
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
  layout?: ReactNode;
  actions?: ReactNode;
  dependencies?: ReactNode;
  focusPending: boolean;
  onFocused: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusPending) return;
    focusInPlace(
      ref.current
        ?.querySelector('[role="tabpanel"]:not([hidden])')
        ?.querySelector<HTMLElement>(EDITING_CONTROL),
    );
    onFocused();
  }, [focusPending, onFocused]);

  return (
    <div ref={ref}>
      {parent && (
        <div className="px-card pt-2">
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            aria-label={`Back to ${parent.label}`}
            onClick={parent.onSelect}
            className="max-w-full"
          >
            <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">Back to {parent.label}</span>
          </Button>
        </div>
      )}
      <InspectorHeader title={heading} extra={headingActions} />
      <SidebarSections
        sections={sections}
        active={sections.includes(section) ? section : sections[0]!}
        onSelect={onSection}
        layout={layout}
        actions={actions}
        dependencies={dependencies}
      >
        {children}
      </SidebarSections>
    </div>
  );
}
