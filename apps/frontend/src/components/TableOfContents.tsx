import React, { useEffect, useState } from "react";

export type TocLevel = 1 | 2 | 3 | 4;

export type TocSection = { id: string; label: string; level: TocLevel };

interface TableOfContentsProps {
  tocSections: TocSection[];
}

function tocLinkClassName(level: TocLevel, active: boolean): string {
  switch (level) {
    case 1:
      return `block py-3 pb-0.5 font-medium first:pt-0 text-xl transition-colors ${
        active ? "text-black" : "text-zinc-900 hover:text-black"
      }`;
    case 2:
      return `block py-3 text-base lg:text-lg transition-colors ${
        active ? "text-black font-medium" : "text-zinc-500 hover:text-black"
      }`;
    case 3:
      return `block pl-4 py-1 text-base lg:text-lg transition-colors border-l-2 ${
        active
          ? "text-green font-medium border-green"
          : "text-zinc-500 hover:text-zinc-900 border-zinc-300"
      }`;
    case 4:
      return `block pl-8 py-1 text-sm lg:text-base transition-colors border-l-2 ${
        active
          ? "text-green font-medium border-green"
          : "text-zinc-500 hover:text-zinc-900 border-zinc-300"
      }`;
    default:
      throw new Error(`unknown toc level: ${level satisfies never}`);
  }
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ tocSections }) => {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    tocSections[0]?.id ?? "",
  );

  useEffect(() => {
    if (tocSections.length === 0) return;

    const offsetFromTop = 140;

    const updateActiveSection = () => {
      const activeSection =
        tocSections
          .map(({ id }) => document.getElementById(id))
          .filter((section): section is HTMLElement => Boolean(section))
          .reduce<HTMLElement | null>((currentActiveSection, section) => {
            if (section.getBoundingClientRect().top <= offsetFromTop) {
              return section;
            }
            return currentActiveSection;
          }, null) ?? document.getElementById(tocSections[0].id);

      if (activeSection?.id) {
        setActiveSectionId(activeSection.id);
      }
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [tocSections]);

  return (
    <nav
      aria-label="Table of contents"
      className="hidden lg:block shrink-0 w-52"
    >
      <div className="sticky top-22 flex flex-col">
        {tocSections.map(({ id, label, level }) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activeSectionId === id ? "location" : undefined}
            className={tocLinkClassName(level, activeSectionId === id)}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
};

export default TableOfContents;
