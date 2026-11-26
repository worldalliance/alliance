import { TriangleAlert } from "lucide-react";
import { countOf } from "../../../lib/formatNumber";
import Badge, { BadgeTone } from "../../../ui/Badge";
import Button, { ButtonVariant, buttonVariants } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { InfoTip } from "../../../ui/InfoTip";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/Popover";
import type { FormReach } from "./useFormReach";

/** Why a save reaches members, true to the server's read of a form on each open. */
function liveSentence({ taskLive, responses }: FormReach): string {
  return taskLive
    ? "Members can open this task now, so each save of this form reaches them the next time they open it."
    : `This form has ${countOf(responses ?? 0, "response")}. Each save reaches members the next time they open the form.`;
}

/**
 * The toolbar's fixed slot saying a save is live for members, or that it
 * couldn't be checked. Empty at the same width while unknown or not live, so
 * nothing appears above or beside the panes later.
 */
export function LiveFormStatus({ reach }: { reach: FormReach }) {
  return (
    <div className="flex w-16 shrink-0 items-center gap-1">
      {reach.live && (
        <>
          <Badge tone={BadgeTone.Info}>Live</Badge>
          <InfoTip label="About Live">{liveSentence(reach)}</InfoTip>
        </>
      )}
      {reach.failed && (
        <Popover>
          <PopoverTrigger
            aria-label="Live check failed"
            className={cn(
              "inline-flex text-warning",
              buttonVariants({ variant: ButtonVariant.Ghost, size: "small" }),
            )}
          >
            <TriangleAlert aria-hidden="true" className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent className="flex w-72 flex-col items-start gap-2">
            <p>
              {reach.task && reach.taskLive === undefined
                ? "Couldn't check whether members can open this task"
                : "Couldn't check whether this form reaches members"}
              , so saves that remove questions or options, or change a
              question's kind, ask first.
            </p>
            <Button
              variant={ButtonVariant.Ghost}
              size="small"
              onClick={reach.retry}
            >
              Try again
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
