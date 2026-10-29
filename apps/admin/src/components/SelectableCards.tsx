import { cn } from "@alliance/shared/styles/util";
import { CircleCheck } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";

const GroupName = createContext<string | null>(null);

const cardClass =
  "flex flex-col justify-start gap-1 rounded-lg border-2 bg-white p-3 text-left text-xs";

const CardTitle = ({ children }: { children: ReactNode }) => (
  <span className="mb-1 block text-sm font-medium">{children}</span>
);

const cardGrid = "grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3";

export const SelectableCardGroup = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm">{label}</legend>
      <div className={cardGrid}>
        <GroupName.Provider value={name}>{children}</GroupName.Provider>
      </div>
    </fieldset>
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
}) => {
  const name = useContext(GroupName);
  if (name === null) {
    throw new Error("SelectableCard renders only inside a SelectableCardGroup");
  }
  return (
    <label
      className={cn(
        cardClass,
        "cursor-pointer border-zinc-200 hover:border-zinc-400 has-[:checked]:border-green has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <CardTitle>
        <span className="flex items-start justify-between gap-1">
          {title}
          {selected && (
            <CircleCheck className="size-4 shrink-0 text-green" aria-hidden />
          )}
        </span>
      </CardTitle>
      {children}
    </label>
  );
};
