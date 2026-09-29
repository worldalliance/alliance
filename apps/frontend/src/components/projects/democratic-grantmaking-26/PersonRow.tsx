import { uploadSrc } from "@alliance/common/image-src";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { getApiUrl } from "../../../lib/config";
import type { ProjectPerson } from "./placeholders";

export function PersonAvatar({
  pictureKey,
  className,
}: {
  pictureKey: string;
  className?: string;
}) {
  return (
    <AvatarProfile
      pfp={uploadSrc({ key: pictureKey, apiUrl: getApiUrl() })}
      size="override"
      thumbnail
      alt=""
      className={cn("size-8 shrink-0 rounded-[2px]", className)}
    />
  );
}

export function PersonRow({
  person,
  onDark = false,
}: {
  person: ProjectPerson;
  onDark?: boolean;
}) {
  return (
    <div className="site-sans flex items-center gap-2.5 text-sm leading-snug">
      <PersonAvatar pictureKey={person.pictureKey} />
      <div className="flex flex-col">
        <span className={onDark ? "text-white" : "text-zinc-900"}>
          {person.name}
        </span>
        <span className={onDark ? "text-white/80" : "text-zinc-500"}>
          {person.role}
        </span>
      </div>
    </div>
  );
}
