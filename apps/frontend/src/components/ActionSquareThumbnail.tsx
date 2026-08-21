import { cn } from "@alliance/shared/styles/util";
import { MousePointerClick } from "lucide-react";

interface ActionSquareThumbnailProps {
  imgSrc?: string;
  imgAlt?: string;
  size: "smallDynamic" | "mediumDynamic";
}

const ActionSquareThumbnail: React.FC<ActionSquareThumbnailProps> = ({
  imgSrc,
  imgAlt,
  size = "mediumDynamic",
}: ActionSquareThumbnailProps) => {
  const sizeClass = {
    mediumDynamic: "w-24 md:w-48 h-24 md:h-48 rounded-md",
    smallDynamic: "w-12 h-12 md:w-28 md:h-28 rounded",
  };

  const iconSizeClass = {
    mediumDynamic: "w-12 h-12 md:w-16 md:h-16",
    smallDynamic: "w-6 h-6 md:w-12 md:h-12",
  };

  return imgSrc ? (
    <img
      src={imgSrc}
      alt={imgAlt || "image"}
      title={imgAlt || "action thumbnail"}
      className={cn("shrink-0 object-cover", sizeClass[size])}
    />
  ) : (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-zinc-100 text-zinc-300 shrink-0",
        sizeClass[size],
      )}
    >
      <MousePointerClick className={iconSizeClass[size]} />
    </div>
  );
};

export default ActionSquareThumbnail;
