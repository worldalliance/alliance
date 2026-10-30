import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureGit } from "./fixture-git";

const PATHS = join(import.meta.dir, "worktree-paths.sh");
const LIB = join(import.meta.dir, "worktree-registry.sh");
const ID = "01a1896a-5f11-7000-8135-8f20e509f8e3";
const OTHER_ID = "01a1896a-5f11-7000-8135-8f20e509f8e4";

let root: string;
let main: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "worktree-registry-")));
  main = join(root, "alliance-main");
  fixtureGit(root, "init", "-q", "-b", "main", main);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function withRecord(params: { name: string; then: string }) {
  const { name } = params;
  const db = `alliance_${name.replaceAll("-", "_")}`;
  const record = [
    `name=${name}`,
    "parent=main",
    `dir=${join(root, `alliance-${name}`)}`,
    `db=${db}`,
    `test_db=${db}_test`,
    `branch=${name}`,
    "branch_created=1",
    "slot=3",
  ].join("\n");
  const result = spawnSync(
    "bash",
    [
      "-c",
      `set -euo pipefail; repo_root="${main}"; source "${PATHS}"; source "${LIB}"; mkdir -p "$instances/${ID}"; printf '%s\\n' "$RECORD" > "$instances/${ID}/record"; ${params.then}`,
    ],
    { cwd: main, encoding: "utf8", env: { ...process.env, RECORD: record } },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return result.stdout;
}

const problemAfter = (edit: string) =>
  withRecord({ name: "foo", then: `${edit}; record_problem ${ID}` });

test("a record its name derives passes", () => {
  expect(problemAfter("true")).toBe("");
});

test("a dashed name's databases take underscores", () => {
  const problem = (edit: string) =>
    withRecord({ name: "foo-bar", then: `${edit}; record_problem ${ID}` });
  expect(problem("true")).toBe("");
  expect(problem(`set_record_field ${ID} db alliance_foo-bar`)).toContain(
    "names databases other than alliance_foo_bar and alliance_foo_bar_test",
  );
});

test.each([
  ["parent", OTHER_ID],
  ["branch_added", "1"],
  ["dir_added", "1"],
])("%s=%s passes", (field, value) => {
  expect(problemAfter(`set_record_field ${ID} ${field} '${value}'`)).toBe("");
});

test.each([
  ["name", "Foo", "has an invalid name 'Foo'"],
  ["parent", "nope", "has an invalid parent 'nope'"],
  ["dir", "/elsewhere", "names a directory other than"],
  [
    "db",
    "alliance_other",
    "names databases other than alliance_foo and alliance_foo_test",
  ],
  [
    "test_db",
    "alliance_foo_e2e",
    "names databases other than alliance_foo and alliance_foo_test",
  ],
  ["branch", "bad..branch", "has an invalid branch"],
  ["branch", "", "has an invalid branch"],
  ["branch_created", "2", "has an invalid branch_created"],
  ["branch_added", "0", "has an invalid branch_added"],
  ["dir_added", "yes", "has an invalid dir_added"],
  ["slot", "x", "has an invalid slot"],
])("%s=%s is refused", (field, value, problem) => {
  expect(problemAfter(`set_record_field ${ID} ${field} '${value}'`)).toContain(
    problem,
  );
});

test("a branch named by checkout history is refused", () => {
  fixtureGit(main, "commit", "-q", "--allow-empty", "-m", "start");
  fixtureGit(main, "checkout", "-q", "-b", "other");
  fixtureGit(main, "checkout", "-q", "main");

  expect(problemAfter(`set_record_field ${ID} branch '@{-1}'`)).toBe(
    "has an invalid branch\n",
  );
});

test("a record naming the main checkout is refused", () => {
  expect(withRecord({ name: "main", then: `record_problem ${ID}` })).toBe(
    "names the main checkout\n",
  );
});

test("a record under an id that is not a UUID is refused", () => {
  expect(
    withRecord({
      name: "foo",
      then: `mv "$instances/${ID}" "$instances/x y"; record_problem "x y"`,
    }),
  ).toBe("has an invalid id 'x y'\n");
});

test("a missing record is refused", () => {
  expect(problemAfter(`rm "$instances/${ID}/record"`)).toBe(
    "has no record file\n",
  );
});

test("set_record_field replaces a field and keeps = and backslashes in a value", () => {
  const out = withRecord({
    name: "foo",
    then: `set_record_field ${ID} branch 'a=b'; set_record_field ${ID} branch 'c=d\\t'; record_field ${ID} branch; grep -c '^branch=' "$instances/${ID}/record"`,
  });
  expect(out).toBe("c=d\\t\n1\n");
});

test("sweep_registry_leftovers keeps only the graveyard of a running remover", () => {
  const out = withRecord({
    name: "foo",
    then: `mkdir "$instances/.new-x" "$instances/.deleted-${OTHER_ID}-99999999" "$(graveyard_for ${OTHER_ID})"; sweep_registry_leftovers; LC_ALL=C ls -A "$instances"; echo "$$"`,
  });
  const [graveyard, record, pid] = out.trim().split("\n");
  expect(graveyard).toBe(`.deleted-${OTHER_ID}-${pid}`);
  expect(record).toBe(ID);
});

test("records_with and record_fields skip staged records", () => {
  const out = withRecord({
    name: "foo",
    then: `mkdir "$instances/.new-x"; sed 's/^slot=.*/slot=4/' "$instances/${ID}/record" > "$instances/.new-x/record"; records_with name foo; record_fields slot`,
  });
  expect(out).toBe(`${ID}\n3\n`);
});

test("records_with and record_fields find nothing without an instances directory", () => {
  const out = withRecord({
    name: "foo",
    then: `rm -rf "$instances"; records_with name foo; record_fields slot`,
  });
  expect(out).toBe("");
});
