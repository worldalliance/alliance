import {
  NO_TIME_LABEL,
  type TimeZoneSelectItem,
  useTimeZoneSelect,
} from "@alliance/shared/forms/timeZoneSelect";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import { cn } from "@alliance/shared/styles/util";
import { Combobox } from "@base-ui/react/combobox";
import { Check, MonitorSmartphone } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Spinner from "../ui/Spinner";
import { zIndex } from "../ui/zIndex";
import { itemClassName, listClassName, popupClassName } from "./optionPicker";

type Props = {
  labelId?: string;
  value?: string;
  defaultValue?: string; // defaults to America/Los_Angeles
  onChange?: (tz: string) => void;

  placeholder?: string;
  disabled?: boolean;
  className?: string;

  // optional: 12h vs 24h
  hour12?: boolean;
};

// Rows sharing a zone name differ only by city, so the name is what gets cut.
function ZoneLabel({ zoneName, city }: TimeZoneSelectItem) {
  return (
    <div className="flex min-w-0 text-zinc-900">
      {zoneName && <span className="truncate">{`${zoneName} ·\u00a0`}</span>}
      <span className="max-w-full shrink-0 truncate">{city}</span>
    </div>
  );
}

export default function TimeZoneSelectPretty({
  labelId,
  value,
  defaultValue = "America/Los_Angeles",
  onChange,
  placeholder = "Select time zone…",
  disabled,
  className,
  hour12 = true,
}: Props) {
  const valueId = useId();
  const [detected] = useState(deviceTimeZone);
  const {
    filtered,
    selected,
    deviceTz,
    query,
    setQuery,
    commit,
    open,
    setOpen,
  } = useTimeZoneSelect({
    value,
    defaultValue,
    onChange,
    hour12,
    disabled,
    deviceTimeZone: detected,
  });

  // Base UI finds the selected row, to highlight and scroll to on open, only
  // while closed, and the rows are built on the first open and wait for the
  // warm-up, so it opens a commit after they arrive.
  const [listed, setListed] = useState(false);
  useLayoutEffect(
    () => setListed((was) => open && (was || filtered.length > 0)),
    [open, filtered.length],
  );
  // Base UI counts itself closed until then, so the trigger cancels the open.
  // A mouse press acts on mousedown, a keyboard press on a click of detail 0.
  const waiting = open && !listed;
  const cancelWaiting = (e: { preventBaseUIHandler: () => void }) => {
    setOpen(false);
    e.preventBaseUIHandler();
  };

  // WebKit sends a mousemove at the same coordinates when the list or page
  // scrolls under a still pointer, and can report a real move with no
  // movementX. The baseline is wherever the pointer last was on the page, and
  // the capture listener runs before the rows' handlers read the result.
  const pointerMoved = useRef(false);
  useEffect(() => {
    let last: { x: number; y: number } | null = null;
    const onMove = (e: MouseEvent) => {
      pointerMoved.current =
        last != null && (last.x !== e.clientX || last.y !== e.clientY);
      last = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("mousemove", onMove, { capture: true });
    return () =>
      document.removeEventListener("mousemove", onMove, { capture: true });
  }, []);

  return (
    <div className={className ?? ""}>
      <div className="max-w-[700px]">
        <Combobox.Root<TimeZoneSelectItem>
          items={filtered}
          filteredItems={filtered}
          value={selected}
          isItemEqualToValue={(item, other) => item.tz === other.tz}
          onValueChange={(item) => {
            if (item) commit(item.tz);
          }}
          open={open && listed}
          onOpenChange={setOpen}
          inputValue={query}
          onInputValueChange={(next, details) => {
            if (details.reason !== "input-clear") setQuery(next);
          }}
          autoHighlight
          disabled={disabled}
        >
          <Combobox.Trigger
            aria-labelledby={labelId ? `${labelId} ${valueId}` : valueId}
            onMouseDown={(e) => {
              if (waiting) cancelWaiting(e);
            }}
            onClick={(e) => {
              if (waiting && e.detail === 0) cancelWaiting(e);
            }}
            onKeyDown={(e) => {
              if (waiting && e.key === "Escape") cancelWaiting(e);
            }}
            onBlur={(e) => {
              if (waiting) cancelWaiting(e);
            }}
            className={[
              "w-full rounded border border-zinc-300 bg-white px-3 py-3 text-left",
              "hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            <div
              id={valueId}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                {selected.labelLeft ? (
                  <ZoneLabel {...selected} />
                ) : (
                  <div className="truncate text-zinc-900">{placeholder}</div>
                )}
                {selected.labelSub && (
                  <div className="truncate text-[13px] text-zinc-500">
                    {selected.labelSub}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-sm">
                  {selected.timeLabel ?? NO_TIME_LABEL}
                </div>
                {waiting ? (
                  <Spinner size="small" />
                ) : (
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
                )}
              </div>
            </div>
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner sideOffset={4} className={zIndex.popover}>
              <Combobox.Popup className={popupClassName}>
                <div className="p-2 border-b border-zinc-100">
                  <Combobox.Input
                    aria-label="Search time zones"
                    placeholder="Search time zones…"
                    className="w-full rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <Combobox.Empty className="p-3 text-zinc-500 empty:p-0">
                  No matches
                </Combobox.Empty>
                <Combobox.List className={listClassName}>
                  {(item: TimeZoneSelectItem) => (
                    <Combobox.Item
                      key={item.tz}
                      value={item}
                      onMouseMove={(e) => {
                        if (!pointerMoved.current) e.preventBaseUIHandler();
                      }}
                      className={cn(
                        itemClassName,
                        "gap-3 py-3 data-selected:bg-green/10!",
                      )}
                    >
                      <div className="min-w-0">
                        <ZoneLabel {...item} />
                        {item.labelSub && (
                          <div className="truncate text-[13px] text-zinc-500">
                            {item.labelSub}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {item.tz === deviceTz && (
                          <MonitorSmartphone
                            className="w-4 h-4 text-zinc-500"
                            role="img"
                          >
                            <title>Device time zone</title>
                          </MonitorSmartphone>
                        )}
                        <div className="text-[14px] tabular-nums text-zinc-800">
                          {item.timeLabel ?? NO_TIME_LABEL}
                        </div>
                        <Combobox.ItemIndicator>
                          <Check
                            className="w-4 h-4 text-green"
                            strokeWidth={3}
                          />
                        </Combobox.ItemIndicator>
                      </div>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    </div>
  );
}
