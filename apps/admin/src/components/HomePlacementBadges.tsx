import React from "react";
import {
  type HomePlacement,
  INACTIVE_REASON_COPY,
  PLACEMENT_BADGE_COPY,
} from "../lib/homePlacement";

const HomePlacementBadges: React.FC<{ placement: HomePlacement }> = ({
  placement,
}) =>
  placement.inactive ? (
    <span className="text-xs text-zinc-500 italic shrink-0">
      Not on home pages: {INACTIVE_REASON_COPY[placement.inactive]}
    </span>
  ) : (
    placement.badges.map((badge) => (
      <span
        key={badge}
        title={PLACEMENT_BADGE_COPY[badge].description}
        className="text-xs px-2 py-0.5 rounded-full shrink-0 border border-zinc-300 text-zinc-700"
      >
        {PLACEMENT_BADGE_COPY[badge].label}
      </span>
    ))
  );

export default HomePlacementBadges;
