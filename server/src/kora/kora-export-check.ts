import { KoraReviewStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import type { ValidateFunction } from "ajv/dist/2020";
import { ajvProblems } from "./kora-upload";

export type CheckedExport = {
  statuses: Map<string, KoraReviewStatus>;
  profileAnswered: boolean;
};

const fields = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

function statusOf(result: Record<string, unknown>): KoraReviewStatus {
  if (result.optedOut === true) return KoraReviewStatus.OptedOut;
  if (result.status === "done") return KoraReviewStatus.Done;
  return KoraReviewStatus.Pending;
}

const resultsOf = (exported: Record<string, unknown>) =>
  Array.isArray(exported.results) ? exported.results.map(fields) : [];

export const resultTranscriptIds = (
  exported: Record<string, unknown>,
): string[] => resultsOf(exported).map((r) => String(r.transcriptId));

export function withoutResultsFor(
  exported: Record<string, unknown>,
  transcriptIds: ReadonlySet<string>,
): Record<string, unknown> {
  if (transcriptIds.size === 0) return exported;
  return {
    ...exported,
    results: resultsOf(exported).filter(
      (r) => !transcriptIds.has(String(r.transcriptId)),
    ),
  };
}

/** Checks a saved export belongs to this reviewer and assignment, and reviewed the content it was given. */
export function checkExport(params: {
  exported: Record<string, unknown>;
  validate: ValidateFunction;
  reviewerId: string;
  assignmentId: string;
  transcripts: { id: string; contentHash: string }[];
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
  if (exported.batchId !== params.assignmentId) {
    return R.failure("names a different assignment");
  }
  const results = resultsOf(exported);
  const expected = new Map(
    params.transcripts.map((t) => [t.id, t.contentHash]),
  );
  const statuses = new Map<string, KoraReviewStatus>();
  for (const result of results) {
    const id = String(result.transcriptId);
    const hash = expected.get(id);
    if (hash === undefined) {
      return R.failure(
        `has a result for transcript ${id}, which isn't assigned`,
      );
    }
    if (result.contentHash !== hash) {
      return R.failure(`reviewed different content for transcript ${id}`);
    }
    statuses.set(id, statusOf(result));
  }
  if (statuses.size !== expected.size) {
    return R.failure("is missing results for assigned transcripts");
  }
  return R.success({
    statuses,
    profileAnswered:
      exported.profile !== null && exported.profile !== undefined,
  });
}
