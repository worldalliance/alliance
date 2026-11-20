import { KoraReviewStatus } from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { slicePoints } from "@alliance/kora-review/highlights";
import type {
  KoraExport,
  KoraReaction,
  KoraResult,
  KoraTurn,
} from "@alliance/kora-review/types";
import type { ValidateFunction } from "ajv/dist/2020";
import { ajvProblems } from "./kora-upload";

export type CheckedExport = {
  statuses: Map<string, KoraReviewStatus>;
  profileAnswered: boolean;
  optOutCategories: string[];
};

const fields = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

function statusOf(result: KoraResult): KoraReviewStatus {
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
  const current = exported.currentTranscriptId;
  return {
    ...exported,
    results: resultsOf(exported).filter(
      (r) => !transcriptIds.has(String(r.transcriptId)),
    ),
    ...(typeof current === "string" &&
      transcriptIds.has(current) && { currentTranscriptId: null }),
  };
}

/** Why a reaction isn't a span of one of the chatbot's turns, as the conversation has it, or null when it is. */
function reactionProblem(
  reaction: KoraReaction,
  conversation: KoraTurn[],
): string | null {
  const { turnIndex, charStart, charEnd } = reaction;
  const turn = conversation[turnIndex];
  if (turn?.role !== "ai")
    return `reacts to turn ${turnIndex}, which isn't the chatbot's`;
  if (charEnd <= charStart || charEnd > [...turn.text].length)
    return `reacts outside turn ${turnIndex}'s text`;
  if (slicePoints(turn.text, charStart, charEnd) !== reaction.text)
    return `quotes text turn ${turnIndex} doesn't have at its reaction's offsets`;
  return null;
}

/** Checks a saved export belongs to this reviewer and assignment, and reviewed the content it was given. */
export function checkExport(params: {
  exported: Record<string, unknown>;
  validate: ValidateFunction<KoraExport>;
  reviewerId: string;
  assignmentId: string;
  transcripts: { id: string; contentHash: string; conversation: KoraTurn[] }[];
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
  const expected = new Map(params.transcripts.map((t) => [t.id, t]));
  const statuses = new Map<string, KoraReviewStatus>();
  for (const result of exported.results) {
    const id = result.transcriptId;
    const transcript = expected.get(id);
    if (transcript === undefined) {
      return R.failure(
        `has a result for transcript ${id}, which isn't assigned`,
      );
    }
    if (result.contentHash !== transcript.contentHash) {
      return R.failure(`reviewed different content for transcript ${id}`);
    }
    for (const reaction of result.reactions) {
      const problem = reactionProblem(reaction, transcript.conversation);
      if (problem) return R.failure(`${problem} in transcript ${id}`);
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
    optOutCategories: Array.isArray(exported.optOutCategories)
      ? exported.optOutCategories.map(String)
      : [],
  });
}

/** Transcripts whose result differs from the one in the previous export. */
export function changedResults(
  previous: unknown,
  exported: Record<string, unknown>,
): Set<string> {
  const before = new Map(
    resultsOf(fields(previous)).map((r) => [
      String(r.transcriptId),
      JSON.stringify(r),
    ]),
  );
  return new Set(
    resultsOf(exported)
      .filter((r) => before.get(String(r.transcriptId)) !== JSON.stringify(r))
      .map((r) => String(r.transcriptId)),
  );
}
