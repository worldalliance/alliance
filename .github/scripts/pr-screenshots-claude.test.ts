import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test("Claude capture requires a successful terminal event and preserves CLI failures", () => {
  const directory = mkdtempSync(resolve("../.scratch/claude-run-test-"));
  const bin = resolve(directory, "bin");
  try {
    mkdirSync(bin);
    mkdirSync(resolve(directory, ".scratch/pr-screenshots"), {
      recursive: true,
    });
    mkdirSync(resolve(directory, "controller/skills/pr-screenshots"), {
      recursive: true,
    });
    writeFileSync(
      resolve(directory, "controller/skills/pr-screenshots/REMOTE.md"),
      "Synthetic test prompt",
    );
    writeFileSync(
      resolve(directory, ".scratch/pr-screenshots/claude-proxy.json"),
      '{"port":12345}',
    );
    writeFileSync(resolve(bin, "sudo"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    writeFileSync(
      resolve(bin, "claude"),
      '#!/bin/sh\ncat >/dev/null\nprintf "%s\\n" "$FAKE_STREAM"\nexit "$FAKE_EXIT"\n',
      { mode: 0o755 },
    );
    for (const input of [
      {
        stream: '{"type":"result","is_error":false}',
        exit: "0",
        success: true,
      },
      {
        stream: '{"type":"result","is_error":true}',
        exit: "0",
        success: false,
      },
      { stream: '{"type":"assistant"}', exit: "0", success: false },
      {
        stream: '{"type":"result","is_error":false}',
        exit: "1",
        success: false,
      },
      { stream: "not JSON", exit: "0", success: false },
    ]) {
      const result = Bun.spawnSync(
        ["bash", resolve(import.meta.dir, "pr-screenshots-claude.sh")],
        {
          cwd: directory,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            FAKE_STREAM: input.stream,
            FAKE_EXIT: input.exit,
          },
        },
      );
      expect(result.exitCode === 0).toBe(input.success);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
