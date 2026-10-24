import { cn } from "@alliance/shared/styles/util";
import { ImageIcon } from "lucide-react";

export function PictureSlot({
  src,
  className,
}: {
  src?: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("rounded-md object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-zinc-200 text-zinc-400",
        className,
      )}
    >
      <ImageIcon className="size-1/3" aria-hidden />
    </div>
  );
}
