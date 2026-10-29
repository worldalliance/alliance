import { cn } from "@alliance/shared/styles/util";
import { useId, type ReactNode } from "react";

export const SelectableCardGroup = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-sm">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3"
      >
        {children}
      </div>
    </div>
  );
};

export const SelectableCard = ({
  selected,
  onSelect,
  title,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  children: ReactNode;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={cn(
      "flex flex-col justify-start gap-1 rounded-lg border-2 bg-white p-3 text-left text-xs",
      selected ? "border-green" : "border-zinc-200 hover:border-zinc-400",
    )}
  >
    <span className="mb-1 block text-sm font-medium">{title}</span>
    {children}
  </button>
);
