import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  type PickableKind,
  type Target,
  targetKey,
  targetKindLabel,
  targetName,
} from "./shareLinkTargets";

const loadingText: Record<PickableKind, string> = {
  action: "Loading actions…",
  external: "Loading external targets…",
};

const searchPlaceholder: Record<PickableKind, string> = {
  action: "Search actions…",
  external: "Search external targets…",
};

const TargetPicker: React.FC<{
  kind: PickableKind;
  targets: Target[];
  loadError: string | null;
  loading: boolean;
  value: Target | null;
  onChange: (target: Target | null) => void;
  disabled?: boolean;
}> = ({ kind, targets, loadError, loading, value, onChange, disabled }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return targets;
    return targets.filter((t) => targetName(t).toLowerCase().includes(term));
  }, [targets, query]);

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="text-xs font-medium text-zinc-700">
        {targetKindLabel(kind)}
      </label>
      {loadError && <p className="text-xs text-red-500">{loadError}</p>}
      {value ? (
        <div className="flex flex-row items-center gap-2 border border-zinc-300 rounded px-3 py-2 text-sm bg-white">
          <span className="flex-1 truncate">{targetName(value)}</span>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-900"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            className="border border-zinc-300 rounded px-3 py-2 text-sm"
            placeholder={searchPlaceholder[kind]}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
          />
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 border border-zinc-200 rounded bg-white shadow-md max-h-72 overflow-y-auto z-10">
              {loading ? (
                <p className="px-3 py-2 text-sm text-zinc-500">
                  {loadingText[kind]}
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-zinc-500">No matches.</p>
              ) : (
                filtered.map((t) => (
                  <button
                    type="button"
                    key={targetKey(t)}
                    className="w-full flex flex-row items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 text-left"
                    onClick={() => {
                      onChange(t);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{targetName(t)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TargetPicker;
