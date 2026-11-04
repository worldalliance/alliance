import { Undo2, X } from "lucide-react";
import { iconControlClass } from "./ActionLinks";

const DismissToggle = ({
  dismissed,
  what,
  iconClassName,
  onToggle,
}: {
  dismissed: boolean;
  what?: string;
  iconClassName: string;
  onToggle: () => void;
}) => {
  const label = [dismissed ? "Restore" : "Dismiss", what]
    .filter(Boolean)
    .join(" ");
  const Icon = dismissed ? Undo2 : X;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={iconControlClass}
    >
      <Icon className={iconClassName} />
    </button>
  );
};

export default DismissToggle;
