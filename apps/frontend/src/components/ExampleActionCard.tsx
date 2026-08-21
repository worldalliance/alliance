import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@alliance/shared/styles/util";
import { Link } from "react-router";

import ExampleDropdownCard from "./ExampleDropdownCard";

interface ExampleActionCardProps {
  name: string;
  description: ReactNode;
  link: string;
  bgColor?: "grey" | "white";
  dropdown?: boolean;
}

const ExampleActionCard: React.FC<ExampleActionCardProps> = ({
  name,
  description,
  link,
  bgColor = "grey",
  dropdown = false,
}: ExampleActionCardProps) => {
  if (dropdown) {
    return (
      <ExampleDropdownCard title={name} bgColor={bgColor}>
        <div className="min-w-0">{description}</div>
        <Link
          to={link}
          className="flex w-fit flex-row items-center gap-x-1 font-medium text-zinc-500 underline"
        >
          Action details
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </ExampleDropdownCard>
    );
  }

  const shell = cn(
    "rounded p-6",
    bgColor === "grey"
      ? "bg-grey-0 hover:bg-grey-1"
      : "bg-white hover:bg-green/5",
  );

  return (
    <Link
      to={link}
      className={cn(
        "flex flex-row items-center justify-between gap-x-3 md:gap-x-4",
        shell,
      )}
    >
      <div className="flex flex-row items-start justify-between gap-x-3 md:gap-x-4 ">
        <div className="flex flex-1 flex-col">
          <div className="flex flex-row items-center justify-between gap-x-2">
            <p className="font-medium text-green">{name}</p>
          </div>
          <p className=" text-zinc-500">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-green" aria-hidden />
    </Link>
  );
};

export default ExampleActionCard;
