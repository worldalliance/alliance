import { cn } from "@alliance/shared/styles/util";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

interface SeeAllProps {
  link: string;
  size: "sm" | "md" | "lg";
}

const SeeAll = ({ link, size }: SeeAllProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const iconSize = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  return (
    <Link
      to={link}
      className={cn(
        "bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center rounded-full shrink-0 ",
        sizeClasses[size],
      )}
    >
      <ChevronRight
        size={iconSize[size]}
        className="shrink-0 text-zinc-500 mx-2"
      />
    </Link>
  );
};

export default SeeAll;
