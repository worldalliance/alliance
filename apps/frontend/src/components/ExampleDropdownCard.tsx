import { ChevronDown } from "lucide-react";
import { ReactNode, useId, useState } from "react";

import { cn } from "@alliance/shared/styles/util";

type ExampleDropdownCardProps = {
  title: ReactNode;
  titleClass?: string;
  /** Shown when expanded. */
  children: ReactNode;
  bgColor?: "grey" | "white";
};

const ExampleDropdownCard: React.FC<ExampleDropdownCardProps> = ({
  title,
  titleClass = "",
  children,
  bgColor = "grey",
}) => {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md p-6",
        bgColor === "grey"
          ? "bg-grey-0 hover:bg-grey-1"
          : "bg-white hover:bg-green/5",
      )}
    >
      <button
        type="button"
        className="flex w-full flex-row items-center justify-between gap-x-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className={cn("min-w-0 font-medium text-green", titleClass)}>
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-green transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={contentId}
        role="region"
        aria-label="Details"
        hidden={!expanded}
        className="flex flex-col gap-3 text-zinc-500"
      >
        {children}
      </div>
    </div>
  );
};

export default ExampleDropdownCard;
