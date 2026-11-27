import { X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Select } from "../../../ui/Select";

const PrerequisitePicker: React.FC<{
  value: number[];
  onChange: (ids: number[]) => void;
  availableActions: { id: number; name: string }[];
  actionId?: number;
  loading?: boolean;
  loadFailed?: boolean;
}> = ({
  value,
  onChange,
  availableActions,
  actionId,
  loading = false,
  loadFailed = false,
}) => {
  const nameOf = (id: number) =>
    availableActions.find((action) => action.id === id)?.name ??
    (loading ? "Loading…" : `Task #${id}`);
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLSelectElement>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return;
    setFocusIndex(null);
    const chip = listRef.current?.children.item(focusIndex);
    (chip?.querySelector("button") ?? addRef.current)?.focus();
  }, [focusIndex]);

  const addable = availableActions.filter(
    (action) => action.id !== actionId && !value.includes(action.id),
  );

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-fg-muted">
          No prerequisites. Members are decided without waiting on other tasks.
        </p>
      ) : (
        <ul
          ref={listRef}
          aria-label="Prerequisites"
          className="flex flex-wrap gap-2"
        >
          {value.map((id, i) => (
            <li
              key={id}
              className="inline-flex h-control-sm max-w-full items-center gap-1 rounded-md border border-line bg-surface-2 pl-2.5"
            >
              <span className="truncate">{nameOf(id)}</span>
              <Button
                variant={ButtonVariant.Ghost}
                size="small"
                className="min-h-0 px-1.5"
                aria-label={`Remove prerequisite: ${nameOf(id)}`}
                title="Remove prerequisite"
                onClick={() => {
                  onChange(value.filter((other) => other !== id));
                  setFocusIndex(i < value.length - 1 ? i : i - 1);
                }}
              >
                <X aria-hidden className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Select
        ref={addRef}
        aria-label="Add prerequisite"
        value=""
        disabled={loading}
        onChange={(e) => {
          const id = parseInt(e.target.value);
          if (id) onChange([...value, id]);
        }}
      >
        <option value="">
          {loading
            ? "Loading tasks…"
            : loadFailed
              ? "Couldn't load tasks"
              : "Add prerequisite…"}
        </option>
        {addable.map((action) => (
          <option key={action.id} value={action.id}>
            {action.name}
          </option>
        ))}
      </Select>
    </div>
  );
};

export default PrerequisitePicker;
