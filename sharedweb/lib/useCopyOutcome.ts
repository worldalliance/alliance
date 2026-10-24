import type { ClipboardContent } from "@alliance/shared/lib/clipboard";
import { milliseconds } from "date-fns";
import { useEffect, useState } from "react";
import { copyOutcome, type CopyOutcome } from "./clipboard";

/** The outcome of the last copy, cleared two seconds after it lands. */
export function useCopyOutcome(): [
  CopyOutcome | null,
  (content: string | ClipboardContent) => Promise<void>,
] {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);

  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(
      () => setOutcome(null),
      milliseconds({ seconds: 2 }),
    );
    return () => clearTimeout(timer);
  }, [outcome]);

  const copy = async (content: string | ClipboardContent) =>
    setOutcome(await copyOutcome(content));
  return [outcome, copy];
}
