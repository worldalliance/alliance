import { ChevronLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { focusInPlace } from "../kit/revealInPane";
import { InspectorHeader } from "./InspectorHeader";
import { SidebarSection, SidebarSections } from "./sidebarSections";

const scrollParent = (el: HTMLElement) => {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
};

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
  const active = sections.includes(section) ? section : sections[0]!;

  // The tabs stick under the header, so a switch made while scrolled down
  // starts the new panel under them rather than at the old offset.
  const shownSection = useRef(active);
  useLayoutEffect(() => {
    if (shownSection.current === active) return;
    shownSection.current = active;
    const list = ref.current?.querySelector<HTMLElement>('[role="tablist"]');
    const panel = ref.current?.querySelector<HTMLElement>(
      '[role="tabpanel"]:not([hidden])',
    );
    const pane = list && scrollParent(list);
    if (!list || !panel || !pane) return;
    const hidden =
      list.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
    if (hidden > 0) pane.scrollTop -= hidden;
  }, [active]);

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
        active={active}
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
