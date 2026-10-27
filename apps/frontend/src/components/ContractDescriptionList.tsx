import { cn } from "@alliance/shared/styles/util";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { ChevronDown } from "lucide-react";
import type React from "react";
import { useId, useState } from "react";

function FormalTextDropdown({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="flex w-fit items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        Full text
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <div
        id={contentId}
        hidden={!open}
        className="rounded bg-zinc-50 p-4 text-sm text-zinc-700"
      >
        <AppMarkdownWrapper markdownContent={markdown} />
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
            <li key={index} className="flex gap-x-4">
              <span className="shrink-0 size-8 md:size-9 flex items-center justify-center rounded bg-[var(--site-primary)] text-white text-lg md:text-xl font-semibold leading-none tabular-nums">
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
