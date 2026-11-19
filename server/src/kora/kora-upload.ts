import {
  KORA_PRACTICE_COUNT,
  KORA_SHORT_TURNS,
  KoraItemType,
} from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import {
  fromKoraConversation,
  readKoraRecords,
} from "@alliance/kora-review/convert";
import { conversationSchema } from "@alliance/kora-review/schemas";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { createHash } from "node:crypto";

export type RejectedLine = { line: number; problems: string[] };

export function koraAjv(): Ajv2020 {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return ajv;
}

export function ajvProblems(
  errors: ErrorObject[] | null | undefined,
): string[] {
  return (errors ?? []).map(
    (e) =>
      `${e.instancePath || "the conversation"} ${e.message ?? "is invalid"}`,
  );
}

const validConversation = koraAjv().compile(conversationSchema);

export function contentHash(content: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
}

type IdCheck = {
  id: string;
  line: number;
  seen: Map<string, number>;
  existingIds: ReadonlySet<string>;
  retiredIds: ReadonlySet<string>;
  noun: string;
};

/** Collisions within the file and against earlier batches. Records the id either way, so a repeat of a repeat still reports. */
function idProblems({
  id,
  line,
  seen,
  existingIds,
  retiredIds,
  noun,
}: IdCheck): string[] {
  const earlier = seen.get(id);
  seen.set(id, earlier ?? line);
  if (earlier !== undefined)
    return [`repeats ${noun} ${id} from line ${earlier}`];
  if (retiredIds.has(id))
    return [
      `${noun} ${id} belongs to a retired batch, so reactivate that batch instead`,
    ];
  if (existingIds.has(id))
    return [`${noun} ${id} was already uploaded in an earlier batch`];
  return [];
}

export type CheckedConversation = {
  id: string;
  riskId: string;
  itemType: KoraItemType;
  nTurns: number;
  /** From the import where it says so, else every conversation longer than the short length. */
  optIn: boolean;
  content: Record<string, unknown>;
  contentHash: string;
};

/** The schema has already allowed only these four, so this only narrows the type. */
const koraItemType = (value: unknown): KoraItemType => {
  const known = Object.values(KoraItemType).find((type) => type === value);
  if (!known) throw new Error(`unknown Kora item type: ${String(value)}`);
  return known;
};

const roleOf = (turn: unknown): string =>
  turn && typeof turn === "object" && "role" in turn ? String(turn.role) : "";

/** What the schema can't state: the conversation's shape, and that nTurns describes it (spec 6.0, Annex B). */
function structureProblems(content: Record<string, unknown>): string[] {
  const turns = Array.isArray(content.conversation) ? content.conversation : [];
  const roles = turns.map(roleOf);
  const problems: string[] = [];
  if (roles[0] !== "child") problems.push("doesn't start on a child turn");
  if (roles.some((role, i) => i > 0 && role === roles[i - 1]))
    problems.push("has two turns in a row from the same speaker");
  const ai = roles.filter((role) => role === "ai").length;
  if (content.nTurns !== ai)
    problems.push(
      `says nTurns ${String(content.nTurns)} but has ${ai} AI turns`,
    );
  return problems;
}

type Counted = { line: number; itemType: string; riskId: string };

/**
 * Rules over the file as a whole (6.0 section 10). The practice conversations are counted against
 * what is already stored, because a review has two of them however many files it arrives in.
 */
function fileProblems(
  counted: Counted[],
  existingPractice: number,
): RejectedLine[] {
  const rejected: RejectedLine[] = [];
  const attention = new Map<string, number>();
  for (const { line, itemType, riskId } of counted) {
    if (itemType !== KoraItemType.Attention) continue;
    const earlier = attention.get(riskId);
    if (earlier === undefined) attention.set(riskId, line);
    else
      rejected.push({
        line,
        problems: [
          `${riskId} already has an attention conversation, on line ${earlier}`,
        ],
      });
  }
  const practice = counted.filter(
    (c) => c.itemType === KoraItemType.Practice,
  ).length;
  const total = existingPractice + practice;
  if (total > KORA_PRACTICE_COUNT)
    rejected.push({
      line: 1,
      problems: [
        `this would leave ${total} practice conversations; a review has ${KORA_PRACTICE_COUNT}`,
      ],
    });
  return rejected;
}

/** Converts every line of KORA's conversation file and reports every line that fails, so an upload is all or nothing. */
export function checkConversations(params: {
  text: string;
  existingIds: ReadonlySet<string>;
  retiredIds: ReadonlySet<string>;
  /** Practice conversations already stored, which the two this review has are counted against. */
  existingPractice: number;
}): Result<CheckedConversation[], RejectedLine[]> {
  const rejected: RejectedLine[] = [];
  const checked: CheckedConversation[] = [];
  const counted: Counted[] = [];
  const seen = new Map<string, number>();
  for (const record of readKoraRecords(params.text)) {
    if (!record.ok) {
      rejected.push({
        line: record.line,
        problems: [`couldn't be read: ${record.error}`],
      });
      continue;
    }
    const content = fromKoraConversation(record.record);
    const problems = validConversation(content)
      ? structureProblems(content)
      : ajvProblems(validConversation.errors);
    const id = content.conversationId;
    if (typeof id !== "string") {
      rejected.push({ line: record.line, problems });
      continue;
    }
    problems.push(
      ...idProblems({
        ...params,
        id,
        line: record.line,
        seen,
        noun: "conversation",
      }),
    );
    if (problems.length > 0) {
      rejected.push({ line: record.line, problems });
      continue;
    }
    counted.push({
      line: record.line,
      itemType: String(content.itemType),
      riskId: String(content.riskId),
    });
    const nTurns = Number(content.nTurns);
    checked.push({
      id,
      riskId: String(content.riskId),
      itemType: koraItemType(content.itemType),
      nTurns,
      optIn:
        typeof content.optIn === "boolean"
          ? content.optIn
          : nTurns > KORA_SHORT_TURNS,
      content,
      contentHash: contentHash(content),
    });
  }
  rejected.push(...fileProblems(counted, params.existingPractice));
  if (rejected.length > 0)
    return R.failure(rejected.sort((a, b) => a.line - b.line));
  if (checked.length === 0)
    return R.failure([
      { line: 1, problems: ["the file holds no conversations"] },
    ]);
  return R.success(checked);
}
