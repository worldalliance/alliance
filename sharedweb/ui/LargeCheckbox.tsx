import { cn } from "@alliance/shared/styles/util";

interface LargeCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const LargeCheckbox: React.FC<LargeCheckboxProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
}: LargeCheckboxProps) => {
  return (
    <label className={cn("flex items-center", disabled && "opacity-50")}>
      <input
        type="checkbox"
        className="w-5 h-5 accent-black cursor-pointer disabled:cursor-not-allowed"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ml-2">{label}</span>
    </label>
  );
};

export default LargeCheckbox;
