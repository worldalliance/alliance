import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { R } from "../../../../../../../common/src/result";
import {
  type CaptureRecord,
  CaptureRecordKind,
} from "../../testing/capture-record";
import { CLAUDE_CODE_VERSION } from "../protocol";

export {
  CaptureRecordKind,
  formatCapture,
  readCapture,
  readCaptureLine,
  type CaptureRecord,
} from "../../testing/capture-record";

export const captureDir = (version: string) =>
  fileURLToPath(new URL(`./captures/${version}/`, import.meta.url));

export const captured = (name: string) =>
  path.join(captureDir(CLAUDE_CODE_VERSION), `${name}.jsonl`);

export const authStatusArgs = ["auth", "status", "--json"];

/** What `claude auth status --json` writes, exiting 1 when signed out. */
export const authStatusReply = (loggedIn: boolean): CaptureRecord[] => [
  {
    kind: CaptureRecordKind.Out,
    text: JSON.stringify({
      loggedIn,
      authMethod: loggedIn ? "claude.ai" : "none",
    }),
  },
  { kind: CaptureRecordKind.Exit, code: loggedIn ? 0 : 1 },
];

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
