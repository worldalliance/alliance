import {
  NO_TIME_LABEL,
  useTimeZoneSelect,
} from "@alliance/shared/forms/timeZoneSelect";
import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import type React from "react";
import { zIndex } from "../ui/zIndex";

type Props = {
  value?: string;
  defaultValue?: string; // defaults to America/Los_Angeles
  onChange?: (tz: string) => void;

  placeholder?: string;
  disabled?: boolean;
  className?: string;

  // optional: 12h vs 24h
  hour12?: boolean;
};

export default function TimeZoneSelectPretty({
  value,
  defaultValue = "America/Los_Angeles",
  onChange,
  placeholder = "Select time zone…",
  disabled,
  className,
  hour12 = true,
}: Props) {
  const {
    filtered,
    selected,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    commit,
    open,
    setOpen,
  } = useTimeZoneSelect({
    value,
    defaultValue,
    onChange,
    hour12,
    disabled,
  });

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(0);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) commit(item.tz);
      return;
    }
  }

  return (
    <div className={className ?? ""}>
      <div className="relative max-w-[700px]">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          className={[
            "w-full rounded border border-zinc-300 bg-white px-3 py-3 text-left",
            "hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-zinc-900">
                {selected.labelLeft || placeholder}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-sm">
                {selected.timeLabel ?? NO_TIME_LABEL}
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                className="opacity-70"
              >
                <path
                  d="M5.5 7.5L10 12l4.5-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </button>

        {open && !disabled && (
          <div
            className={cn(
              zIndex.popover,
              "absolute w-full rounded border border-zinc-200 bg-white shadow-lg overflow-hidden",
            )}
            onKeyDown={onListKeyDown}
          >
            <div className="p-2 border-b border-zinc-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search time zones…"
                className="w-full rounded-lg px-3 py-2 focus:outline-none"
              />
            </div>

            <div className="max-h-[320px] overflow-auto">
              {filtered.length === 0 ? (
                <div className="p-3 text-zinc-500">No matches</div>
              ) : (
                filtered.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  const isSelected = item.tz === selected.tz;
                  const time = item.timeLabel ?? NO_TIME_LABEL;

                  return (
                    <button
                      key={item.tz}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => commit(item.tz)}
                      className={[
                        "w-full px-3 py-3 text-left",
                        "flex items-center justify-between gap-3",
                        isActive ? "bg-zinc-100" : "bg-white",
                        selected.tz === item.tz
                          ? "!bg-green/10 text-white"
                          : "",
                      ].join(" ")}
                    >
                      <div className="truncate text-zinc-900">
                        {item.labelLeft}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="text-[14px] tabular-nums text-zinc-800">
                          {time}
                        </div>
                        {isSelected && (
                          <Check
                            className="w-4 h-4 text-green"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {open && (
        <button
          type="button"
          className={cn(zIndex.popoverBackdrop, "fixed inset-0 cursor-default")}
          onClick={() => setOpen(false)}
          aria-label="Close"
          tabIndex={-1}
          style={{ background: "transparent" }}
        />
      )}
    </div>
  );
}
