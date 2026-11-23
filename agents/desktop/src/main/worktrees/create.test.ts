import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CreationStage } from "../../shared/worktree";
import { stageOf, worktreeName } from "./create";

describe("worktreeName", () => {
  test("joins the request's first words with dashes, in lowercase", () => {
    expect(worktreeName("Fix the Signup page's copy!", new Set())).toBe(
      "fix-the-signup-page-s-copy",
    );
  });

  test("stops at a whole word before 37 characters", () => {
    const name = worktreeName(
      "Make the admin panel's member list sortable by every single column",
      new Set(),
    );
    expect(name).toBe("make-the-admin-panel-s-member-list");
    expect(name.length).toBeLessThanOrEqual(37);
  });

  test("cuts a first word longer than the limit", () => {
    expect(worktreeName("a".repeat(60), new Set())).toBe("a".repeat(37));
  });

  test("drops accents and falls back to worktree for a request with no letters or digits", () => {
    expect(worktreeName("Café menu", new Set())).toBe("cafe-menu");
    expect(worktreeName("Résumé parser", new Set())).toBe("resume-parser");
    expect(worktreeName("¿¡…!?", new Set())).toBe("worktree");
  });

  test("adds the first free number when the name is taken", () => {
    expect(
      worktreeName("Fix it", new Set(["fix-it", "fix-it-2", "fix-it-4"])),
    ).toBe("fix-it-3");
  });
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
