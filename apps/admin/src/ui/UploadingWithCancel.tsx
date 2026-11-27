import { X } from "lucide-react";
import { cn } from "./cn";

export default function UploadingWithCancel({
  label,
  cancelLabel,
  onCancel,
  className,
}: {
  label: string;
  cancelLabel: string;
  onCancel: () => void;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-x-1", className)}>
      {label}
      <button
        type="button"
        onClick={onCancel}
        aria-label={cancelLabel}
        title={cancelLabel}
        className="rounded-sm text-fg-muted focus-ring hover:text-fg"
      >
        <X size={16} />
      </button>
    </span>
  );
}
