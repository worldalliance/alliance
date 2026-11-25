import { PenLine } from "lucide-react";
import { useComposerNames } from "../../lib/mmsThreadsLive";
import { cn } from "../../ui/cn";

const names = new Intl.ListFormat("en", { type: "conjunction" });

export const replyingLabel = (adminNames: string[]): string | null =>
  adminNames.length === 0
    ? null
    : `${names.format(adminNames)} ${adminNames.length === 1 ? "is" : "are"} replying…`;

/** An announced notice renders while empty too, so screen readers announce
 * it when it fills, and holds its line so nothing moves when it does. A
 * notice in a list row passes `announce={false}`, since its announcement
 * wouldn't say which thread it is about. */
export default function ComposingNotice({
  phoneNumber,
  announce = true,
  className,
}: {
  phoneNumber: string;
  announce?: boolean;
  className?: string;
}) {
  const label = replyingLabel(useComposerNames(phoneNumber));
  if (!announce && label === null) return null;
  return (
    <p
      role={announce ? "status" : undefined}
      className={cn(
        "flex min-h-4 min-w-0 items-center gap-1 text-caption font-medium text-info",
        className,
      )}
    >
      {label && (
        <>
          <PenLine aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </>
      )}
    </p>
  );
}
