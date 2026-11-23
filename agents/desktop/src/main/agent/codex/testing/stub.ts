import { fileURLToPath } from "node:url";
import { stubReplay } from "../../testing/stub-replay";
import type { CodexCli } from "../process";

export const stubCapturesVariable = "ALLIANCE_AGENT_CODEX_STUB_CAPTURES";

const stub = stubReplay({
  variable: stubCapturesVariable,
  scratchPrefix: "codex-stub-",
});

export const { replay, stopReplay, writeCapture } = stub;

export const stubCli: CodexCli = {
  executable: fileURLToPath(new URL("./stub-codex.ts", import.meta.url)),
  // In the scratch folder stopReplay removes, so the home each run creates doesn't outlive the test.
  get folders() {
    return {
      claudeConfigDir: "/nonexistent/claude",
      codexHome: stub.scratchPath("home"),
    };
  },
};
