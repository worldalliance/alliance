import { KoraReviewStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import type { ValidateFunction } from "ajv/dist/2020";
import { ajvProblems } from "./kora-upload";

export type CheckedExport = {
  statuses: Map<string, KoraReviewStatus>;
};

const fields = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

const ratingsOf = (exported: Record<string, unknown>) =>
  Array.isArray(exported.ratings) ? exported.ratings.map(fields) : [];
const skipsOf = (exported: Record<string, unknown>) =>
  Array.isArray(exported.skips) ? exported.skips.map(fields) : [];

export const ratedConversationIds = (
  exported: Record<string, unknown>,
): string[] => ratingsOf(exported).map((r) => String(r.conversationId));

/** Drops the ratings and skips for conversations the host has taken out of the session. */
export function withoutRatingsFor(
  exported: Record<string, unknown>,
  conversationIds: ReadonlySet<string>,
): Record<string, unknown> {
  if (conversationIds.size === 0) return exported;
  const place = fields(exported.place);
  const open = place.conversationId;
  return {
    ...exported,
    ratings: ratingsOf(exported).filter(
      (r) => !conversationIds.has(String(r.conversationId)),
    ),
    skips: skipsOf(exported).filter(
      (s) => !conversationIds.has(String(s.conversationId)),
    ),
    ...(typeof open === "string" &&
      conversationIds.has(open) && {
        place: { conversationId: null, screen: null },
      }),
  };
}

/** Checks a saved export belongs to this reviewer and session, and rated the content it was given. */
export function checkExport(params: {
  exported: Record<string, unknown>;
  validate: ValidateFunction;
  reviewerId: string;
  sessionId: string;
  conversations: { id: string; contentHash: string }[];
}): Result<CheckedExport, string> {
  const { exported, validate } = params;
  if (!validate(exported)) {
    return R.failure(
      `doesn't match the export schema: ${ajvProblems(validate.errors).join("; ")}`,
    );
  }
  if (fields(exported.reviewer).id !== params.reviewerId) {
    return R.failure("names a different reviewer");
  }
  if (exported.sessionId !== params.sessionId) {
    return R.failure("names a different session");
  }
  const expected = new Map(
    params.conversations.map((c) => [c.id, c.contentHash]),
  );
  const statuses = new Map<string, KoraReviewStatus>();
  for (const rating of ratingsOf(exported)) {
    const id = String(rating.conversationId);
    const hash = expected.get(id);
    if (hash === undefined) {
      return R.failure(
        `has a rating for conversation ${id}, which isn't in this session`,
      );
    }
    if (rating.contentHash !== hash) {
      return R.failure(`rated different content for conversation ${id}`);
    }
    statuses.set(
      id,
      rating.status === "done"
        ? KoraReviewStatus.Done
        : KoraReviewStatus.Pending,
    );
  }
  for (const skip of skipsOf(exported)) {
    const id = String(skip.conversationId);
    if (!expected.has(id)) {
      return R.failure(
        `skipped conversation ${id}, which isn't in this session`,
      );
    }
    statuses.set(id, KoraReviewStatus.OptedOut);
  }
  return R.success({ statuses });
}

/** Conversations whose rating differs from the one in the previous export. */
export function changedRatings(
  previous: unknown,
  exported: Record<string, unknown>,
): Set<string> {
  const before = new Map(
    ratingsOf(fields(previous)).map((r) => [
      String(r.conversationId),
      JSON.stringify(r),
    ]),
  );
  return new Set(
    ratingsOf(exported)
      .filter((r) => before.get(String(r.conversationId)) !== JSON.stringify(r))
      .map((r) => String(r.conversationId)),
  );
}
