import { cn } from "@alliance/shared/styles/util";
import { FileJson } from "lucide-react";

export function FormJsonButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center justify-center text-gray-500 hover:text-blue-600",
        className,
      )}
      title={label}
      aria-label={label}
    >
      <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
