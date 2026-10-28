import { cn } from "@alliance/shared/styles/util";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { SITE_COL } from "./ui";

type TocSection = { id: string; label: string };

export function useActiveSection(sections: TocSection[]) {
  const [active, setActive] = useState(sections[0]);

  useEffect(() => {
    const update = () => {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      const passed = sections.filter((s) => {
        const el = document.getElementById(s.id);
        if (!el) return false;
        const landing = parseFloat(getComputedStyle(el).scrollMarginTop);
        return el.getBoundingClientRect().top <= landing + 1;
      });
      setActive((atBottom ? sections.at(-1) : passed.at(-1)) ?? sections[0]);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [sections]);

  return active;
}

function TocLink({
  section,
  current,
  onClick,
  className,
}: {
  section: TocSection;
  current: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <a
      href={`#${section.id}`}
      aria-current={current ? "true" : undefined}
      onClick={onClick}
      className={cn(
        "block py-1.25",
        current
          ? "font-medium text-(--site-primary)"
          : "text-(--site-ink)/60 hover:text-(--site-primary)",
        className,
      )}
    >
      {section.label}
    </a>
  );
}

/** Pinned beside the sections on wide screens; `StickyToc` takes over below that. */
export function InlineToc({
  sections,
  active,
  label,
}: {
  sections: TocSection[];
  active: TocSection | undefined;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="sticky top-28 hidden self-start pl-31 whitespace-nowrap lg:block"
    >
      <ul className="text-lg">
        {sections.map((section) => (
          <li key={section.id}>
            <TocLink section={section} current={section === active} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Pins under the navbar on narrow screens once the first section scrolls beneath it. */
export function StickyToc({
  sections,
  active,
  label,
  columnClassName,
}: {
  sections: TocSection[];
  active: TocSection | undefined;
  label: string;
  columnClassName?: string;
}) {
  const [top, setTop] = useState(0);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const firstId = sections[0]?.id;

  useEffect(() => {
    const header = document.querySelector("header");
    const first = firstId ? document.getElementById(firstId) : null;
    if (!header || !first) return;

    const update = () => {
      const bottom = header.getBoundingClientRect().bottom;
      setTop(bottom);
      setVisible(first.getBoundingClientRect().top < bottom);
    };
    const resize = new ResizeObserver(update);
    resize.observe(header);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [firstId]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  return (
    <nav
      aria-label={label}
      inert={!visible}
      style={{ top }}
      className={cn(
        "fixed inset-x-0 z-80 border-b lg:hidden border-(--site-ink)/12 bg-(--site-surface) text-lg transition-opacity duration-300",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "block w-full text-left transition-colors duration-300",
          open && "bg-zinc-50",
        )}
      >
        <span
          className={cn(
            SITE_COL,
            columnClassName,
            "flex items-center justify-between gap-4 py-4.5",
          )}
        >
          <span className="truncate">{active?.label}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-6 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      <div
        id={listId}
        inert={!open}
        className={cn(
          "grid transition-all duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <ul className="overflow-hidden">
          {sections.map((section) => (
            <li key={section.id}>
              <TocLink
                section={section}
                current={section === active}
                onClick={() => setOpen(false)}
                className={cn(SITE_COL, columnClassName)}
              />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
