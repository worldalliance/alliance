import { cn } from "@alliance/shared/styles/util";
import { X } from "lucide-react";

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
        className="text-gray-500 hover:text-gray-700"
      >
        <X size={16} />
      </button>
    </span>
  );
}
