import { cn } from "@alliance/shared/styles/util";
import { useEffect, useRef, useState } from "react";
import { CHATBOT_USE_STAT } from "./copy";

const CLOSE_DELAY_MS = 200;
const QUOTE_ID = "chatbot-use-stat-quote";

export type StatReveal = ReturnType<typeof useStatReveal>;

/** Open while the pointer or focus is on the claim or its panel; the delay lets the pointer cross between them. */
export function useStatReveal() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  return {
    open,
    handlers: {
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
    },
  };
}

export function ChatbotUseStat({ reveal }: { reveal: StatReveal }) {
  return (
    <a
      href={CHATBOT_USE_STAT.href}
      target="_blank"
      rel="noreferrer"
      aria-describedby={QUOTE_ID}
      className="underline underline-offset-4"
      {...reveal.handlers}
    >
      {CHATBOT_USE_STAT.claim}
    </a>
  );
}

/** Covers the middle two of four stacked hero images, which split the stack's gaps evenly. */
export function ChatbotUseStatPanel({ reveal }: { reveal: StatReveal }) {
  return (
    <div
      {...reveal.handlers}
      className={cn(
        "absolute inset-x-0 top-[calc(25%+1px)] bottom-[calc(25%+1px)] flex flex-col justify-center gap-4 bg-zinc-100 p-6 motion-safe:transition-opacity motion-safe:duration-200 lg:p-8",
        reveal.open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <p id={QUOTE_ID} className="text-lg leading-snug sm:text-xl">
        “{CHATBOT_USE_STAT.quote}”
      </p>
      <a
        href={CHATBOT_USE_STAT.href}
        target="_blank"
        rel="noreferrer"
        tabIndex={reveal.open ? undefined : -1}
        className="text-sm text-[var(--site-ink)]/70 underline underline-offset-2"
      >
        {CHATBOT_USE_STAT.source}
      </a>
    </div>
  );
}
