import { cn } from "@alliance/shared/styles/util";
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export enum SidebarSection {
  Content = "content",
  Conditions = "conditions",
  Advanced = "advanced",
}

export const ALL_SECTIONS = Object.values(SidebarSection);

export const UNCONDITIONAL_SECTIONS = [
  SidebarSection.Content,
  SidebarSection.Advanced,
];

const SECTION_LABELS: Record<SidebarSection, string> = {
  [SidebarSection.Content]: "Content",
  [SidebarSection.Conditions]: "Conditions",
  [SidebarSection.Advanced]: "Advanced",
};

type SidebarSectionsValue = {
  sections: readonly SidebarSection[];
  active: SidebarSection;
  idPrefix: string;
  /** Builder actions closing the Advanced section, after the editor's own settings. */
  actions: ReactNode;
};

const SidebarSectionsContext = createContext<SidebarSectionsValue | null>(null);

/**
 * The settings sidebar's sections, for the editor of the selected element;
 * null elsewhere, as in Output View, where display blocks render as cards.
 * Section panels provide null to what they hold, so an editor inside one
 * doesn't claim the sidebar's sections.
 */
export const useSidebarSections = () => useContext(SidebarSectionsContext);

const tabId = (prefix: string, section: SidebarSection) =>
  `${prefix}-${section}-tab`;
const panelId = (prefix: string, section: SidebarSection) =>
  `${prefix}-${section}-panel`;

export function SidebarSections({
  sections,
  active,
  onSelect,
  actions,
  children,
}: {
  sections: readonly SidebarSection[];
  active: SidebarSection;
  onSelect: (section: SidebarSection) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const idPrefix = useId();
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next =
      sections[
        (sections.indexOf(active) + step + sections.length) % sections.length
      ];
    if (!next) return;
    onSelect(next);
    tabsRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(tabId(idPrefix, next))}`)
      ?.focus();
  };

  return (
    <SidebarSectionsContext.Provider
      value={{ sections, active, idPrefix, actions }}
    >
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Settings sections"
        className="flex border-b border-gray-200 px-4"
        onKeyDown={handleKeyDown}
      >
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            role="tab"
            id={tabId(idPrefix, section)}
            aria-selected={section === active}
            aria-controls={panelId(idPrefix, section)}
            tabIndex={section === active ? 0 : -1}
            onClick={() => onSelect(section)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              section === active
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {SECTION_LABELS[section]}
          </button>
        ))}
      </div>
      {children}
    </SidebarSectionsContext.Provider>
  );
}

/**
 * The selected item's settings, one panel per section the sidebar shows. A
 * panel's contents mount when it is first opened, so a section never visited
 * mounts no editors, and stay mounted while hidden, so their local state
 * survives switching back.
 */
export function SectionPanels(
  panels: Partial<Record<SidebarSection, ReactNode>>,
) {
  const context = useSidebarSections();
  const [visited, setVisited] = useState<ReadonlySet<SidebarSection>>(
    () => new Set(context ? [context.active] : []),
  );
  if (!context) {
    throw new Error("SectionPanels renders inside SidebarSections");
  }
  const { sections, active, idPrefix, actions } = context;
  if (!visited.has(active)) setVisited(new Set([...visited, active]));
  return sections.map((section) => (
    <div
      key={section}
      role="tabpanel"
      id={panelId(idPrefix, section)}
      aria-labelledby={tabId(idPrefix, section)}
      hidden={section !== active}
      className="space-y-4 p-4"
    >
      {visited.has(section) && (
        <>
          <SidebarSectionsContext.Provider value={null}>
            {panels[section]}
          </SidebarSectionsContext.Provider>
          {section === SidebarSection.Advanced && actions}
        </>
      )}
    </div>
  ));
}
