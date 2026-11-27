import {
  type HomePlacement,
  INACTIVE_REASON_COPY,
  PLACEMENT_BADGE_COPY,
} from "../../../lib/homePlacement";
import Badge from "../../../ui/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../ui/Tooltip";

/** Why an item can reach members' home pages, or why it can't. */
export function PlacementBadges({ placement }: { placement: HomePlacement }) {
  if (placement.inactive) {
    return (
      <span className="text-fg-muted">
        Not on home pages: {INACTIVE_REASON_COPY[placement.inactive]}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      {placement.badges.map((badge) => {
        const { label, description } = PLACEMENT_BADGE_COPY[badge];
        return (
          <Tooltip key={badge}>
            <TooltipTrigger
              // Focusable, so the explanation is reachable without a pointer.
              render={<span tabIndex={0} />}
              className="flex rounded-full focus-ring"
            >
              <Badge>{label}</Badge>
              <span className="sr-only">: {description}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{description}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
