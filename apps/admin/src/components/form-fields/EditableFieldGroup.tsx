import type { AnyField, FieldGroup } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { useEffect, useRef, useState } from "react";
import { ConditionalVisibility, RequiredToggle } from "./CommonControls";

type EditableFieldGroupProps = {
  group: FieldGroup;
  onUpdate: (updates: Partial<FieldGroup>) => void;
  onRemove: () => void;
  onUngroup: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  previousFields?: AnyField[];
  children: React.ReactNode;
};

export function EditableFieldGroup({
  group,
  onUpdate,
  onRemove,
  onUngroup,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
  children,
}: EditableFieldGroupProps) {
  const [isExtraMenuOpen, setIsExtraMenuOpen] = useState(false);
  const extraMenuRef = useRef<HTMLDivElement | null>(null);
  const initialVisibilityCount = group.visibleIfFormula?.conditions
    ? Object.keys(group.visibleIfFormula.conditions).length
    : 0;
  const [
    showConditionalVisibilityControl,
    setShowConditionalVisibilityControl,
  ] = useState(() => initialVisibilityCount > 0);

  useEffect(() => {
    const conditionCount = group.visibleIfFormula?.conditions
      ? Object.keys(group.visibleIfFormula.conditions).length
      : 0;
    if (conditionCount > 0 && !showConditionalVisibilityControl) {
      setShowConditionalVisibilityControl(true);
    }
  }, [group.visibleIfFormula, showConditionalVisibilityControl]);

  useEffect(() => {
    if (!isExtraMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!extraMenuRef.current) return;
      if (extraMenuRef.current.contains(event.target as Node)) return;
      setIsExtraMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExtraMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isExtraMenuOpen]);

  return (
    <div
      className={cn(
        "group relative rounded-lg border-2 border-dashed transition-all",
        isDragging
          ? "border-blue-400 shadow-lg opacity-50"
          : "border-gray-300 hover:border-gray-400",
      )}
    >
      <div
        className="absolute -left-3 top-6 transform opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >
        <div className="text-gray-400 hover:text-gray-600 p-2 pr-1 bg-white shadow-lg rounded-sm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="2" cy="2" r="1" />
            <circle cx="6" cy="2" r="1" />
            <circle cx="2" cy="6" r="1" />
            <circle cx="6" cy="6" r="1" />
            <circle cx="2" cy="10" r="1" />
            <circle cx="6" cy="10" r="1" />
          </svg>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Group
          </p>
          <input
            type="text"
            value={group.label ?? ""}
            onChange={(event) =>
              onUpdate({ label: event.target.value || undefined })
            }
            placeholder="Optional label (not shown to respondents)"
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <RequiredToggle
            checked={group.required}
            onChange={(checked) => onUpdate({ required: checked })}
          />
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" ref={extraMenuRef}>
            <button
              type="button"
              onClick={() => setIsExtraMenuOpen((prev) => !prev)}
              className="text-gray-500 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
              aria-haspopup="menu"
              aria-expanded={isExtraMenuOpen}
              aria-label="Group options"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="3.5" cy="8" r="1.2" />
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="12.5" cy="8" r="1.2" />
              </svg>
            </button>
            {isExtraMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg z-10">
                <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={showConditionalVisibilityControl}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setShowConditionalVisibilityControl(checked);
                      if (!checked) {
                        onUpdate({ visibleIfFormula: undefined });
                      }
                    }}
                  />
                  Use conditional visibility
                </label>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50"
                  onClick={onUngroup}
                >
                  Ungroup
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-red-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50"
            title="Remove group"
            type="button"
            aria-label="Remove group"
          >
            ×
          </button>
        </div>
      </div>

      {showConditionalVisibilityControl && (
        <div className="px-4 pt-2">
          <ConditionalVisibility
            field={group}
            previousFields={previousFields || []}
            onChange={(updates) => onUpdate(updates)}
          />
        </div>
      )}

      <div className="space-y-3 p-4 pt-3">{children}</div>
    </div>
  );
}
