import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CreationStage } from "../../shared/worktree";
import { stageOf, worktreeName } from "./create";

test("worktreeName adds the first free number when the name is taken", () => {
  expect(
    worktreeName("fix-it", new Set(["fix-it", "fix-it-2", "fix-it-4"])),
  ).toBe("fix-it-3");
  expect(worktreeName("fix-it", new Set(["fix"]))).toBe("fix-it");
});

test("stageOf reads scripts/new-worktree.sh's stage lines and ignores the rest", () => {
  expect(stageOf("==> copying database alliance -> alliance_x")).toBe(
    CreationStage.CopyingDatabase,
  );
  expect(stageOf("==> creating test database alliance_x_test")).toBe(
    CreationStage.CopyingDatabase,
  );
  expect(stageOf("==> creating worktree /w/alliance-x (slot 2)")).toBe(
    CreationStage.CreatingFolder,
  );
  expect(stageOf("==> copying local (untracked) config")).toBe(
    CreationStage.CopyingSettings,
  );
  expect(stageOf("==> bun install")).toBe(CreationStage.InstallingDependencies);
  expect(stageOf("    server/.env")).toBeUndefined();
});

test("stageOf knows every stage line scripts/new-worktree.sh prints", () => {
  const script = readFileSync(
    new URL("../../../../../scripts/new-worktree.sh", import.meta.url),
    "utf8",
  );
  const stageLines = [...script.matchAll(/^echo "(==> [^"]*)"/gm)].map(
    ([, line]) => line,
  );
  expect(stageLines).not.toHaveLength(0);
  expect(stageLines.filter((line) => stageOf(line) === undefined)).toEqual([]);
});
