import { CircleCheck, ExternalLink } from "lucide-react";
import { createContext, useContext, useId, type ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../ui/cn";

const GroupName = createContext<string | null>(null);

// The border is the same width selected or not, so selecting moves nothing.
const cardClass =
  "flex flex-col justify-start gap-1 rounded-card border bg-surface p-3 text-left text-caption text-fg-muted transition-colors duration-fast";

const CardTitle = ({ children }: { children: ReactNode }) => (
  <span className="mb-1 block text-body font-medium text-fg">{children}</span>
);

const cardGrid = "grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3";

export const SelectableCardGroup = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-medium">{label}</legend>
      <div className="@container">
        <div className={cardGrid}>
          <GroupName.Provider value={name}>{children}</GroupName.Provider>
        </div>
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
        "cursor-pointer border-line hover:border-line-strong has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent",
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
          <CircleCheck
            className={cn(
              "size-4 shrink-0 text-accent",
              !selected && "invisible",
            )}
            aria-hidden
          />
        </span>
      </CardTitle>
      {children}
    </label>
  );
};

export const CardLinks = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const labelId = useId();
  return (
    <div className="@container flex flex-col gap-2">
      <p id={labelId} className="font-medium">
        {label}
      </p>
      <ul aria-labelledby={labelId} className={cardGrid}>
        {children}
      </ul>
    </div>
  );
};

export const CardLink = ({
  to,
  title,
  children,
}: {
  to: string;
  title: ReactNode;
  children: ReactNode;
}) => (
  <li className="flex">
    <Link
      to={to}
      target="_blank"
      rel="noreferrer"
      className={cn(
        cardClass,
        "flex-1 border-line hover:border-line-strong focus-ring",
      )}
    >
      <CardTitle>
        <span className="flex items-center gap-1">
          {title}
          <ExternalLink className="size-3 shrink-0" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </span>
      </CardTitle>
      {children}
    </Link>
  </li>
);
