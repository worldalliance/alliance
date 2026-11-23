import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git } from "../../repository/testing/fixture";

// Stands in for scripts/list-worktrees.ts: the main checkout, then git's worktrees, prunable once their folder is gone, each recorded when fake-records holds a file named after its folder, whose parent defaults to main. It reads git's files rather than running git, since Bun 1.3's spawnSync can return a successful git's output empty on a loaded machine.
const listWorktrees = `import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
const common = path.join(process.cwd(), ".git");
if (existsSync(path.join(common, "fake-list-fails"))) {
  console.error("listing failed on purpose");
  process.exit(1);
}
// A worktree git worktree add is still writing can lack its gitdir file, so this lists it once that file exists.
const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").trim() : "");
const branch = (gitDir: string) => /^ref: refs\\/heads\\/(.+)$/.exec(read(path.join(gitDir, "HEAD")))?.[1] ?? null;
const linked = path.join(common, "worktrees");
const entries = [
  { path: process.cwd(), branch: branch(common) },
  ...(existsSync(linked) ? readdirSync(linked).sort() : []).flatMap((name) => {
    const gitdir = read(path.join(linked, name, "gitdir"));
    return gitdir ? [{ path: path.dirname(gitdir), branch: branch(path.join(linked, name)) }] : [];
  }),
];
const records = path.join(common, "fake-records");
const worktrees = entries.map((entry, index) => {
  const file = path.join(records, path.basename(entry.path));
  const record = index > 0 && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  return {
    path: entry.path,
    state: index === 0 ? "main" : (record?.state ?? "unrecorded"),
    problem: null,
    id: record?.id ?? null,
    name: record?.name ?? null,
    branch: entry.branch,
    parent: record ? (record.parent ?? "main") : null,
    ports: null,
    locked: false,
    prunable: index > 0 && !existsSync(entry.path),
  };
});
console.log(JSON.stringify({ version: 1, worktrees }));
`;

// Stands in for scripts/new-worktree.sh: refuses a folder that exists, prints its stages, waits while fake-hold exists, and fails after creating the folder when fake-fail exists.
const newWorktree = `#!/usr/bin/env bash
set -euo pipefail
name="$1"; from="$3"
common="$(git rev-parse --path-format=absolute --git-common-dir)"
main="$(dirname "$common")"
dir="$(dirname "$main")/alliance-$name"
[[ ! -e "$dir" ]] || { echo "error: $dir already exists" >&2; exit 1; }
mkdir -p "$common/fake-records"
echo "$*" >> "$common/fake-new-worktree-args"
echo "==> copying database alliance -> alliance_$name"
while [[ -e "$common/fake-hold" ]]; do sleep 0.05; done
echo "==> creating worktree $dir (slot 1, child of $main)"
git worktree add -q -b "$name" "$dir" "$from"
if [[ -e "$common/fake-fail" ]]; then
  printf '{"id":"id-%s","name":"%s","state":"half-created"}' "$name" "$name" > "$common/fake-records/alliance-$name"
  echo "error: copying settings failed on purpose" >&2
  exit 1
fi
echo "==> bun install"
printf '{"id":"id-%s","name":"%s","state":"recorded"}' "$name" "$name" > "$common/fake-records/alliance-$name"
echo "worktree ready: $dir"
`;

/** Commits fake worktree scripts to the repository at folder, which tests can steer through files in its git directory: fake-hold, fake-fail and fake-list-fails. */
export function commitWorktreeScripts(folder: string): string {
  const scripts = path.join(folder, "scripts");
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, "list-worktrees.ts"), listWorktrees);
  writeFileSync(path.join(scripts, "new-worktree.sh"), newWorktree);
  chmodSync(path.join(scripts, "new-worktree.sh"), 0o755);
  git(folder, "add", "scripts");
  git(folder, "commit", "-q", "-m", "Fake worktree scripts");
  return git(folder, "rev-parse", "HEAD");
}

/** The file in the main checkout's git directory that steers the fake scripts. */
export const steeringFile = (checkout: string, name: string): string =>
  path.join(checkout, ".git", name);
