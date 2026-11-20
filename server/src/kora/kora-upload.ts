import { R, type Result } from "@alliance/common/result";
import {
  fromKoraConversation,
  readKoraConversations,
} from "@alliance/kora-review/convert";
import { transcriptSchema } from "@alliance/kora-review/schemas";
import type { KoraTranscript } from "@alliance/kora-review/types";
import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { createHash } from "node:crypto";

export type RejectedLine = { line: number; problems: string[] };

export type CheckedTranscript = {
  id: string;
  category: string;
  content: Record<string, unknown>;
  contentHash: string;
};

export function koraAjv(): Ajv2020 {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return ajv;
}

const validTranscript = koraAjv().compile<KoraTranscript>(transcriptSchema);

export function ajvProblems(
  errors: ErrorObject[] | null | undefined,
): string[] {
  return (errors ?? []).map(
    (e) => `${e.instancePath || "the transcript"} ${e.message ?? "is invalid"}`,
  );
}

/** A stored transcript's content. It was checked on upload, so one that no longer fits the schema fails loudly. */
export function storedTranscript(row: {
  id: string;
  content: unknown;
}): KoraTranscript {
  if (validTranscript(row.content)) return row.content;
  throw new Error(
    `Transcript ${row.id}'s stored content doesn't match transcriptSchema: ${ajvProblems(validTranscript.errors).join("; ")}`,
  );
}

export function contentHash(content: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
}

/** Converts every line of KORA's file and reports every line that fails, so an upload is all or nothing. */
export function checkTranscripts(params: {
  text: string;
  existingIds: ReadonlySet<string>;
  retiredIds: ReadonlySet<string>;
}): Result<CheckedTranscript[], RejectedLine[]> {
  const rejected: RejectedLine[] = [];
  const checked: CheckedTranscript[] = [];
  const seen = new Map<string, number>();
  const records = readKoraConversations(params.text);
  for (const record of records) {
    if (!record.ok) {
      rejected.push({
        line: record.line,
        problems: [`couldn't be read: ${record.error}`],
      });
      continue;
    }
    const content = fromKoraConversation(record.record);
    const problems = validTranscript(content)
      ? []
      : ajvProblems(validTranscript.errors);
    const id = content.transcriptId;
    if (typeof id !== "string") {
      rejected.push({ line: record.line, problems });
      continue;
    }
    const earlier = seen.get(id);
    if (earlier !== undefined) {
      problems.push(`repeats transcript ${id} from line ${earlier}`);
    } else if (params.retiredIds.has(id)) {
      problems.push(
        `transcript ${id} belongs to a retired batch, so reactivate that batch instead`,
      );
    } else if (params.existingIds.has(id)) {
      problems.push(
        `transcript ${id} was already uploaded in an earlier batch`,
      );
    }
    seen.set(id, earlier ?? record.line);
    if (problems.length > 0) {
      rejected.push({ line: record.line, problems });
      continue;
    }
    checked.push({
      id,
      category: String(content.category),
      content,
      contentHash: contentHash(content),
    });
  }
  if (rejected.length > 0) return R.failure(rejected);
  if (checked.length === 0) {
    return R.failure([
      { line: 1, problems: ["the file holds no transcripts"] },
    ]);
  }
  return R.success(checked);
}
