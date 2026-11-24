import { mkdirSync } from "node:fs";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";
import { R, type Result } from "../../../../../common/src/result";
import type { AgentFolders } from "./agent-environment";
import { codexConfigArgs, createCodexHome } from "./codex/process";

const quote = (word: string) => `'${word.replaceAll("'", `'\\''`)}'`;

const launcher = (
  executable: Result<string, Error>,
  args: readonly string[],
): string =>
  executable.ok
    ? `#!/bin/sh\nexec ${[executable.value, ...args].map(quote).join(" ")} "$@"\n`
    : `#!/bin/sh\nprintf '%s\\n' ${quote(`Alliance agent: ${executable.error.message}`)} >&2\nexit 127\n`;

/** Writes folders.bin's claude and codex, which run the app's CLIs, or fail naming why the app has none, so a bare name never falls through to a CLI the user installed. Codex's launcher passes the overrides the app's own Codex runs take. Also creates CODEX_HOME, without which Codex refuses every command but --version. */
export function writeAgentLaunchers(params: {
  folders: AgentFolders;
  claude: Result<string, Error>;
  codex: Result<string, Error>;
}): Result<void, Error> {
  const { folders } = params;
  return R.flatMap(createCodexHome(folders), () =>
    R.fromThrowable(
      () => {
        mkdirSync(folders.bin, { recursive: true });
        writeFileAtomic.sync(
          path.join(folders.bin, "claude"),
          launcher(params.claude, []),
          { mode: 0o755 },
        );
        writeFileAtomic.sync(
          path.join(folders.bin, "codex"),
          launcher(params.codex, codexConfigArgs),
          { mode: 0o755 },
        );
      },
      (error) =>
        new Error(
          `Alliance agent couldn't write the agents' claude and codex in ${folders.bin}: ${R.toError(error).message}`,
        ),
    ),
  );
}
