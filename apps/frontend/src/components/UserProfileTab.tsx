import { cn } from "@alliance/shared/styles/util";

interface UserProfileTabProps {
  /** When omitted, only the label is shown (e.g. navigation tabs without a count). */
  number?: number;
  label: string;
  shortLabel?: string;
  selected: boolean;
  onClick: () => void;
}

const UserProfileTab: React.FC<UserProfileTabProps> = ({
  number,
  label,
  shortLabel,
  selected,
  onClick,
}: UserProfileTabProps) => {
  const showNumber = typeof number === "number";
  return (
    <div
      onClick={onClick}
      className={cn(
        "border flex gap-x-1 items-center rounded py-1.5 px-4 text-base cursor-pointer",
        selected ? "bg-black" : "bg-white hover:bg-zinc-50 border-zinc-200"
      )}
    >
      {showNumber && (
        <span
          className={cn("font-medium", selected ? "text-white" : "text-black")}
        >
          {number.toLocaleString()}
        </span>
      )}
      <span className={cn(selected ? "text-white/90" : "text-zinc-600")}>
        <span className="hidden sm:inline">{label}</span>
        <span className="inline sm:hidden">{shortLabel || label}</span>
      </span>
    </div>
  );
};

export default UserProfileTab;
