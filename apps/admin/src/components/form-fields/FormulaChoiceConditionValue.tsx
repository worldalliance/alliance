export const ANY_SELECTED_VALUE = "__ANY_SELECTED__";
export const NO_VALUE_SELECTED = "__NO_VALUE_SELECTED__";
export const SELECTED_COUNT_VALUE = "__SELECTED_COUNT__";

export const INPUT_CLASS =
  "w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";

export function FormulaChoiceConditionValue({
  multiselect,
  value,
  onChange,
}: {
  multiselect: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const anySelected = multiselect && value === ANY_SELECTED_VALUE;
  const noneSelected = value === NO_VALUE_SELECTED;
  const selectedCount = multiselect && value === SELECTED_COUNT_VALUE;
  const matchesValue = !anySelected && !noneSelected && !selectedCount;
  return (
    <div className="space-y-1">
      <select
        aria-label="Match"
        className={INPUT_CLASS}
        value={matchesValue ? "" : value}
        onChange={(event) => onChange(event.target.value)}
      >
        {multiselect && (
          <>
            <option value={ANY_SELECTED_VALUE}>Any option selected</option>
            <option value={SELECTED_COUNT_VALUE}>Number selected…</option>
          </>
        )}
        <option value="">
          {multiselect ? "Includes the value" : "Equals the value"}
        </option>
        <option value={NO_VALUE_SELECTED}>No option selected</option>
      </select>
      {matchesValue && (
        <>
          <input
            type="text"
            aria-label="Choice value"
            placeholder="Choice value"
            className={INPUT_CLASS}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <p
            className={
              value === ""
                ? "text-[11px] text-red-600"
                : "text-[11px] text-gray-500"
            }
          >
            {value === ""
              ? "Type the value of the choice to match."
              : "This question's choices come from a formula, so its value is typed."}
          </p>
        </>
      )}
    </div>
  );
}
