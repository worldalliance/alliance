import { inputClass } from "./controlStyles";

export type DateRange = { start: string; end: string };

const DateRangeInputs = ({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) => (
  <>
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      From
      <input
        type="date"
        value={value.start}
        onChange={(event) => onChange({ ...value, start: event.target.value })}
        className={inputClass}
      />
    </label>
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      To
      <input
        type="date"
        value={value.end}
        onChange={(event) => onChange({ ...value, end: event.target.value })}
        className={inputClass}
      />
    </label>
  </>
);

export default DateRangeInputs;
