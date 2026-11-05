import { useId } from "react";

const PacificDateTimeInput = ({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-y-1 text-sm">
      <label htmlFor={id}>{label} (Pacific)</label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-fit rounded border border-gray-300 px-2 py-1.5 disabled:bg-zinc-50 disabled:text-zinc-500"
      />
    </div>
  );
};

export default PacificDateTimeInput;
