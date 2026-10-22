import { RotateCw } from "lucide-react";

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Retry"
      title="Retry"
      className="rounded p-0.5 text-blue-600 hover:bg-blue-50"
      onClick={onClick}
    >
      <RotateCw size={12} aria-hidden />
    </button>
  );
}
