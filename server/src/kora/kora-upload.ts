import { R, type Result } from "@alliance/common/result";
import { fromKoraPair, readKoraPairs } from "@alliance/kora-review/convert";
import { SAMPLE_EXPORT } from "@alliance/kora-review/sample-export";
import { transcriptSchema } from "@alliance/kora-review/schemas";
import addFormats from "ajv-formats";
import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020";
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

const validTranscript = koraAjv().compile(transcriptSchema);

export function ajvProblems(
  errors: ErrorObject[] | null | undefined,
): string[] {
  return (errors ?? []).map(
    (e) => `${e.instancePath || "the transcript"} ${e.message ?? "is invalid"}`,
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
  const records = readKoraPairs(params.text);
  for (const record of records) {
    if (!record.ok) {
      rejected.push({
        line: record.line,
        problems: [`isn't valid JSON: ${record.error}`],
      });
      continue;
    }
    const content = fromKoraPair(record.record);
    const problems = validTranscript(content)
      ? []
      : ajvProblems(validTranscript.errors);
    const id = String(content.transcriptId);
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

/** The export schema must compile and must accept the review tool's own sample export. */
export function checkExportSchema(
  text: string,
): Result<{ schema: object; validate: ValidateFunction }, string> {
  let schema: unknown;
  try {
    schema = JSON.parse(text);
  } catch (e) {
    return R.failure(
      `The export schema isn't valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return R.failure("The export schema must be a JSON Schema object.");
  }
  let validate: ValidateFunction;
  try {
    validate = koraAjv().compile(schema);
  } catch (e) {
    return R.failure(
      `The export schema isn't a valid JSON Schema: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!validate(SAMPLE_EXPORT)) {
    return R.failure(
      `The export schema rejects the review tool's exports: ${ajvProblems(validate.errors).join("; ")}`,
    );
  }
  return R.success({ schema, validate });
}
