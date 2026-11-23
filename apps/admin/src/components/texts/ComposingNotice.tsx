import { cn } from "@alliance/shared/styles/util";
import { useComposerNames } from "../../lib/mmsThreadsLive";

const names = new Intl.ListFormat("en", { type: "conjunction" });

export const replyingLabel = (adminNames: string[]): string | null =>
  adminNames.length === 0
    ? null
    : `${names.format(adminNames)} ${adminNames.length === 1 ? "is" : "are"} replying…`;

/** An announced notice renders while empty too, so screen readers announce
 * it when it fills. A notice in a list row passes `announce={false}`, since
 * its announcement wouldn't say which thread it is about. */
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
      className={cn("text-xs font-medium text-amber-800", className)}
    >
      {label}
    </p>
  );
}
