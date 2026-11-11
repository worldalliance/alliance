import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { R } from "../../../../../../../common/src/result";

export enum CaptureRecordKind {
  Start = "start",
  In = "in",
  Out = "out",
  Stderr = "stderr",
  StdinClosed = "stdin_closed",
  Exit = "exit",
}

const captureRecord = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal(CaptureRecordKind.Start),
    args: z.array(z.string()),
  }),
  z.strictObject({ kind: z.literal(CaptureRecordKind.In), text: z.string() }),
  z.strictObject({ kind: z.literal(CaptureRecordKind.Out), text: z.string() }),
  z.strictObject({
    kind: z.literal(CaptureRecordKind.Stderr),
    text: z.string(),
  }),
  z.strictObject({ kind: z.literal(CaptureRecordKind.StdinClosed) }),
  z.strictObject({
    kind: z.literal(CaptureRecordKind.Exit),
    code: z.number().nullable(),
  }),
]);

export type CaptureRecord = z.infer<typeof captureRecord>;

/** Throws on a line that isn't a capture record. */
export const readCaptureLine = (line: string): CaptureRecord =>
  captureRecord.parse(JSON.parse(line));

/** One CLI process's records, in the order the recorder saw them. Throws on a line that isn't a capture record, naming the file and line. */
export function readCapture(file: string): CaptureRecord[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line, index) => {
      if (!line) return [];
      try {
        return [readCaptureLine(line)];
      } catch (error) {
        throw new Error(`${file}:${index + 1} isn't a capture record`, {
          cause: error,
        });
      }
    });
}

export const formatCapture = (records: CaptureRecord[]): string =>
  records.map((record) => JSON.stringify(record)).join("\n");

export const captureDir = (version: string) =>
  fileURLToPath(new URL(`./captures/${version}/`, import.meta.url));

const stdinLine = z.object({
  type: z.string(),
  request: z.object({ subtype: z.string() }).partial().optional(),
});

export const stdinShape = (text: string): string =>
  R.match(
    R.fromThrowable(() => stdinLine.parse(JSON.parse(text))),
    {
      success: (value) =>
        [value.type, value.request?.subtype].filter(Boolean).join("/"),
      failure: () => `unreadable line ${JSON.stringify(text)}`,
    },
  );
