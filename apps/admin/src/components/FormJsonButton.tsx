import { cn } from "@alliance/shared/styles/util";
import { FileJson } from "lucide-react";
import { createContext, useContext } from "react";

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

// Blocks nested inside a page item render through the same wrappers, so their
// parent provides null to keep them from reusing its opener.
export const ElementJsonContext = createContext<{ open: () => void } | null>(
  null,
);

export function ElementJsonButton() {
  const context = useContext(ElementJsonContext);
  if (!context) return null;
  return (
    <FormJsonButton
      label="Edit element JSON"
      onClick={context.open}
      className="w-7 h-7 rounded-lg hover:bg-gray-100"
    />
  );
}
