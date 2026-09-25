import { X } from "lucide-react";
import React from "react";

const PrerequisitePicker: React.FC<{
  value: number[];
  onChange: (ids: number[]) => void;
  availableActions: { id: number; name: string }[];
  actionId?: number;
}> = ({ value, onChange, availableActions, actionId }) => {
  const nameOf = (id: number) =>
    availableActions.find((action) => action.id === id)?.name ?? `#${id}`;
  const addable = availableActions.filter(
    (action) => action.id !== actionId && !value.includes(action.id),
  );

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="text-sm text-gray-500">
          No prerequisites. Members are decided without waiting on other
          actions.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm"
            >
              {nameOf(id)}
              <button
                type="button"
                aria-label={`Remove prerequisite ${nameOf(id)}`}
                title="Remove prerequisite"
                onClick={() => onChange(value.filter((other) => other !== id))}
                className="text-gray-500 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        aria-label="Add prerequisite"
        value=""
        onChange={(e) => {
          const id = parseInt(e.target.value);
          if (id) onChange([...value, id]);
        }}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Add prerequisite...</option>
        {addable.map((action) => (
          <option key={action.id} value={action.id}>
            {action.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PrerequisitePicker;
