import { createContext, useContext, useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../ui/Tabs";

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
  /** Builder layout controls closing the Content section, after the editor's own settings. */
  layout: ReactNode;
  /** Builder actions closing the Advanced section, after the editor's own settings. */
  actions: ReactNode;
  /**
   * Closes the Conditions section, after the editor's own settings, or Content
   * for a selection without Conditions, which conditions can still read.
   */
  dependencies: ReactNode;
};

const SidebarSectionsContext = createContext<SidebarSectionsValue | null>(null);

/**
 * The settings sidebar's sections, for the editor of the selected element;
 * null elsewhere, as in Output View, where display blocks render as cards.
 * Section panels provide null to what they hold, so an editor inside one
 * doesn't claim the sidebar's sections.
 */
export const useSidebarSections = () => useContext(SidebarSectionsContext);

export function SidebarSections({
  sections,
  active,
  onSelect,
  layout,
  actions,
  dependencies,
  children,
}: {
  sections: readonly SidebarSection[];
  active: SidebarSection;
  onSelect: (section: SidebarSection) => void;
  layout?: ReactNode;
  actions?: ReactNode;
  dependencies?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarSectionsContext.Provider
      value={{ sections, active, layout, actions, dependencies }}
    >
      <Tabs
        value={active}
        onValueChange={(section: SidebarSection) => onSelect(section)}
      >
        <TabsList
          aria-label="Settings sections"
          activateOnFocus
          className="sticky top-12 z-10 bg-canvas px-card"
        >
          {sections.map((section) => (
            <TabsTab key={section} value={section}>
              {SECTION_LABELS[section]}
            </TabsTab>
          ))}
        </TabsList>
        {children}
      </Tabs>
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
  const { sections, active, layout, actions, dependencies } = context;
  if (!visited.has(active)) setVisited(new Set([...visited, active]));
  const dependenciesSection = sections.includes(SidebarSection.Conditions)
    ? SidebarSection.Conditions
    : SidebarSection.Content;
  return sections.map((section) => (
    <TabsPanel
      key={section}
      value={section}
      keepMounted
      className="flex flex-col gap-5 px-card py-4"
    >
      {visited.has(section) && (
        <>
          <SidebarSectionsContext.Provider value={null}>
            {panels[section]}
          </SidebarSectionsContext.Provider>
          {section === SidebarSection.Content && layout}
          {section === SidebarSection.Advanced && actions}
          {section === dependenciesSection && dependencies}
        </>
      )}
    </TabsPanel>
  ));
}
