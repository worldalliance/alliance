import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { stubReplay } from "../../testing/stub-replay";
import type { ClaudeCli } from "../process";

export const stubCapturesVariable = "ALLIANCE_AGENT_CLAUDE_STUB_CAPTURES";

export const stubCli: ClaudeCli = {
  executable: fileURLToPath(new URL("./stub-claude.ts", import.meta.url)),
  configDir: "/nonexistent/claude",
};

const { writeScratch, ...helpers } = stubReplay({
  variable: stubCapturesVariable,
  scratchPrefix: "claude-stub-",
});
export const { replay, stopReplay, writeCapture } = helpers;

export function hangingCli(): ClaudeCli {
  return {
    executable: writeScratch(randomUUID(), "#!/bin/sh\nexec sleep 30\n", 0o755),
    configDir: "/config",
  };
}
