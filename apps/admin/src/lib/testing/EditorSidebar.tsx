import type { ReactNode } from "react";
import {
  SidebarSection,
  SidebarSections,
} from "../../components/form-canvas/sidebarSections";

const CONTENT = [SidebarSection.Content];

/** The settings sidebar a field editor renders in, showing its Content. */
export function EditorSidebar({ children }: { children: ReactNode }) {
  return (
    <SidebarSections
      sections={CONTENT}
      active={SidebarSection.Content}
      onSelect={() => {}}
    >
      {children}
    </SidebarSections>
  );
}
