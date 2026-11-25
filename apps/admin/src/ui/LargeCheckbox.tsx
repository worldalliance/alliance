import { Checkbox } from "./Checkbox";
import { cn } from "./cn";

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
}: LargeCheckboxProps) => (
  <label className={cn("flex items-center gap-2", disabled && "opacity-50")}>
    <Checkbox
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span>{label}</span>
  </label>
);

export default LargeCheckbox;
