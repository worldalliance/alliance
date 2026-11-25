import type { ConversationExpert } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { AvatarProfile } from "../ui/Avatar";

export function ExpertBubble({
  expert,
  showName,
  caption,
  id,
  faint,
  children,
}: {
  expert: ConversationExpert | null;
  showName?: boolean;
  /** A small line above the bubble, in place of the expert's name. */
  caption?: string;
  id?: string;
  faint?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {caption ? (
        <span className="pl-10 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {caption}
        </span>
      ) : (
        showName &&
        expert && (
          <span className="pl-10 text-xs text-zinc-500">{expert.userName}</span>
        )
      )}
      <div className="flex items-start gap-2">
        <AvatarProfile
          pfp={expert?.userProfilePicture ?? null}
          size="medium"
          alt=""
          className="shrink-0"
        />
        <div
          id={id}
          className={cn(
            "min-w-0 max-w-[85%] rounded-2xl rounded-tl-sm",
            faint
              ? "bg-zinc-100 px-3 py-2"
              : "bg-zinc-200 px-3.5 py-2 text-zinc-900",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
