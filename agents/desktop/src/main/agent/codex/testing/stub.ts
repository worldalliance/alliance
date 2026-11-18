import { fileURLToPath } from "node:url";
import { stubReplay } from "../../testing/stub-replay";
import type { CodexCli } from "../process";

export const stubCapturesVariable = "ALLIANCE_AGENT_CODEX_STUB_CAPTURES";

export const { replay, stopReplay, writeCapture } = stubReplay({
  variable: stubCapturesVariable,
  scratchPrefix: "codex-stub-",
});

export const stubCli: CodexCli = {
  executable: fileURLToPath(new URL("./stub-codex.ts", import.meta.url)),
  home: "/nonexistent/codex",
};
