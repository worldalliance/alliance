import type { RankingField } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import FormTextarea from "../FormTextarea";
import {
  DuplicateOptionsWarning,
  RequiredToggle,
  duplicateOptionValues,
} from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableRankingField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<RankingField>) {
  const duplicates = duplicateOptionValues(field.options);

  const addOption = () => {
    const nextIndex = field.options.length + 1;
    const newOption = {
      label: `Option ${nextIndex}`,
      value: `option${nextIndex}`,
    };
    onUpdate({ options: [...field.options, newOption] });
  };

  const updateOption = (
    index: number,
    updates: { label?: string; value?: string },
  ) => {
    const updated = [...field.options];
    updated[index] = { ...updated[index], ...updates };
    onUpdate({ options: updated });
  };

  const removeOption = (index: number) => {
    const updated = field.options.filter((_, i) => i !== index);
    const updates: Partial<RankingField> = { options: updated };
    if (field.numToRank !== undefined && field.numToRank > updated.length) {
      updates.numToRank = updated.length > 0 ? updated.length : undefined;
    }
    onUpdate(updates);
  };

  const moveOption = (from: number, to: number) => {
    if (to < 0 || to >= field.options.length) return;
    const updated = [...field.options];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onUpdate({ options: updated });
  };

  const handleNumToRankChange = (raw: string) => {
    if (!raw) {
      onUpdate({ numToRank: undefined });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.max(
      1,
      Math.min(Math.floor(parsed), field.options.length),
    );
    onUpdate({ numToRank: clamped });
  };

  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(value) => onUpdate({ label: value })}
      />

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-700">
            Options
          </label>
          <button
            onClick={addOption}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            type="button"
          >
            Add Option
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto py-1">
          {field.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <FormTextarea
                rows={1}
                value={option.label}
                onChange={(e) => updateOption(index, { label: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                placeholder="Option label (markdown)"
              />
              <input
                type="text"
                value={option.value}
                onChange={(e) => updateOption(index, { value: e.target.value })}
                className={cn(
                  "w-20 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
                  duplicates.has(option.value)
                    ? "border-red-500"
                    : "border-gray-300",
                )}
                placeholder="Value"
              />
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => moveOption(index, index - 1)}
                  disabled={index === 0}
                  className="px-1 py-0.5 text-xs rounded border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Move option up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveOption(index, index + 1)}
                  disabled={index === field.options.length - 1}
                  className="px-1 py-0.5 text-xs rounded border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Move option down"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
              <button
                onClick={() => removeOption(index)}
                className="text-red-500 hover:text-red-700 text-sm"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <DuplicateOptionsWarning duplicates={duplicates} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Number of items to rank
        </label>
        <input
          type="number"
          min={1}
          max={field.options.length}
          value={field.numToRank ?? ""}
          onChange={(event) => handleNumToRankChange(event.target.value)}
          placeholder="All options"
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">Defaults to all options.</p>
      </div>
    </FieldWrapper>
  );
}
