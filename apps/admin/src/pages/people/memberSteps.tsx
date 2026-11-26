import { ChevronDown, ChevronUp } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import Button, { ButtonVariant } from "../../ui/Button";

/** Tells the page which members a tab shows, in order, while it shows them. */
export function useReportRowIds(
  onRowIds: ((ids: readonly number[]) => void) | undefined,
  ids: readonly number[],
) {
  const key = [...new Set(ids)].join(",");
  useEffect(() => {
    if (!onRowIds) return;
    onRowIds(key === "" ? [] : key.split(",").map(Number));
    return () => onRowIds([]);
  }, [onRowIds, key]);
}

/** Up and down in the member sheet's header: the list's previous and next row. */
export function MemberSteps({
  ids,
  memberId,
  onStep,
}: {
  ids: readonly number[];
  memberId: number;
  onStep: (userId: number) => void;
}) {
  const index = ids.indexOf(memberId);
  const previous = index > 0 ? ids[index - 1] : undefined;
  const next = index >= 0 ? ids[index + 1] : undefined;
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Reaching an end disables the pressed button, which would drop focus to
  // the page; the other direction takes it.
  const go = (params: {
    to: number;
    end: boolean;
    other: RefObject<HTMLButtonElement | null>;
  }) => {
    onStep(params.to);
    if (params.end) params.other.current?.focus();
  };
  return (
    <>
      <Button
        size="small"
        variant={ButtonVariant.Ghost}
        ref={previousRef}
        disabled={previous === undefined}
        onClick={() =>
          previous !== undefined &&
          go({ to: previous, end: index === 1, other: nextRef })
        }
        aria-label="Previous member in the list"
        title="Previous member in the list"
      >
        <ChevronUp aria-hidden="true" className="size-4" />
      </Button>
      <Button
        size="small"
        variant={ButtonVariant.Ghost}
        ref={nextRef}
        disabled={next === undefined}
        onClick={() =>
          next !== undefined &&
          go({ to: next, end: index + 2 === ids.length, other: previousRef })
        }
        aria-label="Next member in the list"
        title="Next member in the list"
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </Button>
    </>
  );
}
