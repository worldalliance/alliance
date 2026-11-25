import { expect, test } from "bun:test";
import { R } from "../../../../../common/src/result";
import { proposedVersion, type RegistryPackage } from "./cli-bump";
import { claudePackage, codexPackage } from "./cli-versions";

const now = new Date("2026-11-24T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const claude = (pinned: string, distTags: Record<string, string>) =>
  proposedVersion({
    cli: claudePackage,
    pinned,
    registry: { "dist-tags": distTags, time: {}, versions: {} },
    now,
  });

const codex = (
  pinned: string,
  time: RegistryPackage["time"],
  versions: RegistryPackage["versions"] = Object.fromEntries(
    Object.keys(time).map((version) => [version, {}]),
  ),
) =>
  proposedVersion({
    cli: codexPackage,
    pinned,
    registry: { "dist-tags": {}, time, versions },
    now,
  });

test("Claude Code follows its stable tag, never latest", () => {
  expect(claude("2.1.322", { stable: "2.1.325", latest: "2.1.331" })).toEqual(
    R.success("2.1.325"),
  );
});

test("Claude Code stays when stable isn't newer, as when stable moves back", () => {
  expect(claude("2.1.325", { stable: "2.1.325" })).toEqual(
    R.success(undefined),
  );
  expect(claude("2.1.326", { stable: "2.1.325" })).toEqual(
    R.success(undefined),
  );
});

test("a Claude Code registry entry with no stable tag fails", () => {
  expect(claude("2.1.322", { latest: "2.1.331" }).ok).toBe(false);
});

test("a Claude Code stable tag that isn't a version fails", () => {
  expect(claude("2.1.322", { stable: "next" }).ok).toBe(false);
});

test("Codex takes its newest release published at least a week ago, skipping prereleases", () => {
  expect(
    codex("0.167.0", {
      created: daysAgo(400),
      modified: daysAgo(0),
      "0.167.0": daysAgo(20),
      "0.169.0": daysAgo(11),
      "0.168.0": daysAgo(12),
      "0.169.1": daysAgo(7),
      "0.170.0": daysAgo(6),
      "0.171.0-alpha.1": daysAgo(9),
    }),
  ).toEqual(R.success("0.169.1"));
});

test("Codex skips a deprecated release", () => {
  expect(
    codex(
      "0.167.0",
      { "0.168.0": daysAgo(10), "0.169.0": daysAgo(8) },
      { "0.168.0": {}, "0.169.0": { deprecated: "broken sandbox" } },
    ),
  ).toEqual(R.success("0.168.0"));
});

test("Codex skips an unpublished release, which keeps its publish time", () => {
  expect(
    codex(
      "0.167.0",
      { "0.168.0": daysAgo(10), "0.169.0": daysAgo(8) },
      { "0.168.0": {} },
    ),
  ).toEqual(R.success("0.168.0"));
});

test("Codex compares versions numerically, not as text", () => {
  expect(
    codex("0.9.0", { "0.9.0": daysAgo(30), "0.10.0": daysAgo(8) }),
  ).toEqual(R.success("0.10.0"));
});

test("Codex stays when no week-old release is newer than the pinned one", () => {
  expect(
    codex("0.170.0", { "0.169.1": daysAgo(8), "0.171.0": daysAgo(1) }),
  ).toEqual(R.success(undefined));
});
