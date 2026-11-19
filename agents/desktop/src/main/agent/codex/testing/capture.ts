import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { R } from "../../../../../../../common/src/result";
import { gitEnvironment } from "../trust";
import { CODEX_VERSION } from "../version";

export const captureDir = (version: string) =>
  fileURLToPath(new URL(`./captures/${version}/`, import.meta.url));

export const captured = (name: string) =>
  path.join(captureDir(CODEX_VERSION), `${name}.jsonl`);

/** The main checkout's `.codex/hooks.json`, which Codex ran when the captures were recorded. */
export const capturedHooks = path.join(captureDir(CODEX_VERSION), "hooks.json");

/** Makes dir a new checkout, since hook trust starts Codex only at the top of one. */
export function gitCheckout(dir: string): string {
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: dir, env: gitEnvironment() });
  return dir;
}

/** A new checkout in dir holding capturedHooks, so hook trust in a replay compares Codex's recorded listing with the file it listed. */
export function capturedCheckout(dir: string): string {
  const checkout = gitCheckout(path.join(dir, "checkout"));
  mkdirSync(path.join(checkout, ".codex"));
  copyFileSync(capturedHooks, path.join(checkout, ".codex", "hooks.json"));
  return checkout;
}

const stdinLine = z.looseObject({
  method: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  params: z
    .looseObject({
      threadId: z.string().optional(),
      turnId: z.string().optional(),
    })
    .optional(),
});

/** A request or notification's method with the thread and turn ids it names, or "response" for the adapter's answer to a request from app-server. */
export const stdinShape = (text: string): string =>
  R.match(
    R.fromThrowable(() => stdinLine.parse(JSON.parse(text))),
    {
      success: ({ method, id, params }) =>
        method === undefined
          ? id === undefined
            ? "a message without a method"
            : "response"
          : [method, params?.threadId, params?.turnId]
              .filter((part) => part !== undefined)
              .join(" "),
      failure: () => `unreadable line ${JSON.stringify(text)}`,
    },
  );
