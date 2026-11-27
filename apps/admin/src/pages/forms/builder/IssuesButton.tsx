import { withCount } from "@alliance/common/plural";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import Button, { ButtonVariant, buttonVariants } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/Popover";
import {
  IssueGate,
  type IssueRow,
  type LoadFailure,
  type SourceCheck,
} from "./issues/IssueList";
import { focusInPlace } from "./kit/revealInPane";
import { useRestoreFocusWithin } from "./selection/useRestoreFocusWithin";

const GATED_ACTION: Record<IssueGate, string> = {
  [IssueGate.Save]: "saving",
  [IssueGate.Preview]: "previewing",
};

/**
 * The toolbar's count of what blocks Save and Preview, in a slot at least as
 * wide as "No issues" and never truncated, opening a list that links each issue to where it's repaired. `gate`
 * names the action that opened it, which moves focus into the list.
 */
export function IssuesButton({
  rows,
  sources,
  loadFailure,
  loading,
  open,
  gate,
  onOpenChange,
}: {
  rows: readonly IssueRow[];
  sources: SourceCheck;
  loadFailure: LoadFailure | null;
  /** Empties the closed slot, whose issues would be the unloaded form's. */
  loading: boolean;
  open: boolean;
  gate: IssueGate | null;
  onOpenChange: (open: boolean) => void;
}) {
  const listRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const count = rows.length + (loadFailure ? 1 : 0);
  const restoreFocus = useRestoreFocusWithin(listRef);
  // A row that goes away while focused, as a successful retry's does, would
  // leave focus on the page, out of reach of the list's Escape.
  useEffect(() => {
    restoreFocus();
  });
  const nothingToSay =
    count === 0 && sources.pending === 0 && sources.failed === 0;

  const formLoading = loading && !loadFailure;
  if (formLoading && !open) return <div className="w-24 shrink-0" />;

  if (nothingToSay && !open) {
    return (
      <p className="min-w-24 shrink-0 whitespace-nowrap text-caption text-fg-muted">
        No issues
      </p>
    );
  }

  return (
    <div className="min-w-24 shrink-0">
      <Popover
        open={open}
        onOpenChange={(next, { reason }) => {
          if (!next && reason === "escape-key")
            focusInPlace(triggerRef.current);
          onOpenChange(next);
        }}
      >
        <PopoverTrigger
          ref={triggerRef}
          className={cn(
            "whitespace-nowrap",
            buttonVariants({ variant: ButtonVariant.Ghost, size: "small" }),
            count > 0 ? "text-danger" : "text-fg-muted",
          )}
        >
          {count > 0 ? (
            <>
              <CircleAlert aria-hidden="true" className="size-4" />
              {withCount(count, "issue")}
            </>
          ) : formLoading || sources.pending > 0 ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              Checking
            </>
          ) : (
            "No issues"
          )}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          initialFocus={gate ? listRef : false}
          aria-label="Issues"
          className="max-h-120 w-96 overflow-y-auto p-0"
        >
          <section
            ref={listRef}
            role="region"
            aria-label="Issues"
            tabIndex={-1}
            className="flex flex-col gap-3 p-3 outline-none"
          >
            <h2 className="font-semibold">
              {count === 0
                ? formLoading
                  ? "Loading the form"
                  : "No issues"
                : gate
                  ? `Fix ${withCount(count, "issue")} before ${GATED_ACTION[gate]}`
                  : "Issues"}
            </h2>
            {sources.pending > 0 && (
              <p role="status" className="text-caption text-fg-muted">
                Loading the questions of {withCount(sources.pending, "form")}{" "}
                that formulas read. Some issues may clear once they load.
              </p>
            )}
            {sources.failed > 0 && (
              <div className="flex items-start justify-between gap-2 text-caption text-danger">
                <p>{`Couldn't load the questions of ${withCount(sources.failed, "form")} that formulas read.`}</p>
                <Button
                  variant={ButtonVariant.Ghost}
                  size="small"
                  onClick={sources.onRetry}
                >
                  Try again
                </Button>
              </div>
            )}
            <ul className="flex flex-col gap-1">
              {loadFailure && (
                <li className="flex flex-col items-start gap-1 rounded-md px-2 py-1">
                  <span className="font-medium">The form didn't load</span>
                  <span className="text-danger">{loadFailure.message}</span>
                  <Button
                    variant={ButtonVariant.Default}
                    size="small"
                    onClick={loadFailure.onRetry}
                  >
                    {loadFailure.retryLabel}
                  </Button>
                </li>
              )}
              {rows.map(({ location, message, onGo }, index) => {
                const body = (
                  <>
                    <span className="block truncate text-caption text-fg-muted">
                      {location}
                    </span>
                    <span className="block">{message}</span>
                  </>
                );
                return (
                  <li key={index}>
                    {onGo ? (
                      <button
                        type="button"
                        onClick={() => {
                          onGo();
                          onOpenChange(false);
                        }}
                        className="block w-full rounded-md px-2 py-1 text-left focus-ring hover:bg-surface-2"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="px-2 py-1">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </PopoverContent>
      </Popover>
    </div>
  );
}
