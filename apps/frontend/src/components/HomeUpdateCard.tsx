import type { ActionUpdateDto } from "@alliance/shared/client";
import { useUpdateCardContent } from "@alliance/shared/lib/actionUpdateCard";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { resolveImageSrc } from "@alliance/sharedweb/lib/imageSrc";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { ArrowRight, ClipboardList, Layers } from "lucide-react";
import { memo } from "react";
import { href, Link } from "react-router";

const HomeUpdateCard = memo(function HomeUpdateCard({
  update,
  isNew,
  onOpen,
}: {
  update: ActionUpdateDto;
  isNew: boolean;
  onOpen: (updateId: number) => void;
}) {
  const { tiles, hiddenCount, excerpt, participated, markFailed } =
    useUpdateCardContent(update);
  const pictures = update.participantPictures ?? [];

  return (
    <Link
      to={href("/actions/:id", { id: update.actionId.toString() })}
      onClick={() => onOpen(update.id)}
      className="@container group flex h-full flex-col overflow-hidden rounded-md border border-zinc-200 bg-white transition-shadow duration-200 hover:border-zinc-300 hover:shadow-md motion-reduce:transition-none"
    >
      <div
        className={cn(
          "relative grid aspect-3/2 w-full shrink-0 grid-rows-1 gap-0.5 overflow-hidden bg-zinc-100",
          tiles.length === 2 && "grid-cols-2",
          tiles.length >= 3 && "grid-cols-[2fr_1fr] grid-rows-2",
        )}
      >
        {tiles.length === 0 ? (
          <div className="flex size-full items-center justify-center text-zinc-400">
            <ClipboardList size={40} aria-hidden />
          </div>
        ) : (
          tiles.map((cover, position) => (
            <div
              key={cover.src}
              className={cn(
                "relative min-h-0 overflow-hidden",
                tiles.length >= 3 && position === 0 && "row-span-2",
              )}
            >
              <img
                src={resolveImageSrc(cover.src)}
                alt={cover.alt}
                loading="lazy"
                onError={() => markFailed(cover.src)}
                className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              {hiddenCount > 0 && position === tiles.length - 1 && (
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white"
                >
                  +{hiddenCount}
                </span>
              )}
            </div>
          ))
        )}
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          <span className="rounded bg-white/90 px-2 py-0.5 text-sm font-semibold text-zinc-700 shadow-xs backdrop-blur-sm">
            {formatTime(new Date(update.date), { addSuffix: true })}
          </span>
          {isNew && (
            <span className="rounded bg-green-50 px-2 py-0.5 text-sm font-semibold text-green-800">
              New
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-zinc-500">
          <Layers size={16} className="shrink-0" aria-hidden />
          <span className="truncate">{update.actionName}</span>
        </p>
        <p className="line-clamp-2 text-lg font-semibold leading-snug text-zinc-900 group-hover:underline">
          {update.title}
        </p>
        {excerpt && <p className="line-clamp-3 text-zinc-600">{excerpt}</p>}
        <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-3">
          {participated && (
            <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-zinc-500">
              {pictures.length > 0 && (
                <span
                  aria-hidden
                  className="flex shrink-0 items-center -space-x-2 @max-[20rem]:hidden"
                >
                  {pictures.map((picture) => (
                    <span key={picture} className="rounded ring-2 ring-white">
                      <AvatarProfile pfp={picture} size="small" alt="" />
                    </span>
                  ))}
                </span>
              )}
              <span className="truncate">{participated}</span>
            </p>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1 text-sm font-semibold text-zinc-900">
            Read
            <ArrowRight size={16} aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
});

export default HomeUpdateCard;
