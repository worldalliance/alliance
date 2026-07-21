import { type ProfileDto } from "@alliance/shared/client";
import { joinNames } from "./nameList";

const firstName = (u: ProfileDto) =>
  u.displayName.split(" ")[0] ?? u.displayName;

export interface LikeSummaryParts {
  /** Excludes the current user's separate "You" slot. */
  others: ProfileDto[];
  facepile: ProfileDto[];
  label: string;
}

/**
 * Builds the shared facepile label. `likers` must already be in server display
 * order; the current user is represented by the leading "You" slot/avatar.
 */
export function getLikeSummaryParts({
  likers,
  currentUserId,
  liked,
  likesCount,
}: {
  likers: ProfileDto[];
  currentUserId: number | undefined;
  liked: boolean;
  likesCount: number;
}): LikeSummaryParts {
  const others = likers.filter((u) => u.id !== currentUserId);

  const names: string[] = [];
  if (liked) names.push("You");
  for (const u of others) {
    if (names.length >= 2) break;
    names.push(firstName(u));
  }

  const remaining = likesCount - names.length;
  const parts = [...names];
  if (remaining > 0) {
    parts.push(`${remaining} ${remaining === 1 ? "other" : "others"}`);
  }
  const subject = joinNames(parts);
  const verb = likesCount === 1 && !liked ? "likes this" : "like this";

  return {
    others,
    facepile: others.slice(0, liked ? 2 : 3),
    label: `${subject} ${verb}`,
  };
}
