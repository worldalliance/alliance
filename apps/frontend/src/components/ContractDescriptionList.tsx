import { cn } from "@alliance/shared/styles/util";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { ChevronDown } from "lucide-react";
import type React from "react";
import { useId, useState } from "react";

function FormalTextDropdown({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="flex flex-col">
      <button
        type="button"
        className="relative top-[2px] flex w-fit items-center gap-1 self-end text-[0.85em] text-zinc-500 hover:text-zinc-800"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        Formal text
        <ChevronDown
          size={14}
          className={cn(
            "transition-transform duration-150 ease-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={contentId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-2 rounded p-4 text-[1.02em] text-zinc-700">
            <AppMarkdownWrapper markdownContent={markdown} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContractDescriptionList({
  items,
  markdown,
  children,
}: {
  items?: { point: string; subtext: string }[];
  markdown: string;
  children?: React.ReactNode;
}) {
  if (!items?.length && markdown.trim() === "" && !children) return null;
  return (
    <div className="flex flex-col gap-y-5">
      {items && items.length > 0 && (
        <ol className="flex flex-col gap-y-5 list-none pl-0">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-x-4">
              <span
                className={cn(
                  "shrink-0 size-[1.6667em] md:size-[1.6875em] flex items-center justify-center rounded border-2 border-[var(--site-primary)] text-[1.5em] md:text-[1.6667em] font-semibold leading-none tabular-nums",
                  // The first term is the one expectation; the rest are exemptions.
                  index === 0
                    ? "bg-[var(--site-primary)] text-white"
                    : "bg-white text-[var(--site-primary)]",
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex flex-col">
                <div className="font-semibold">
                  <AppMarkdownWrapper markdownContent={item.point} />
                </div>
                {item.subtext.trim() !== "" && (
                  <div className="">
                    <AppMarkdownWrapper markdownContent={item.subtext} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {markdown.trim() !== "" && <FormalTextDropdown markdown={markdown} />}
      {children}
    </div>
  );
}
