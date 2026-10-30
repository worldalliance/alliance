import type { Subprocess } from "bun";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureGit } from "./fixture-git";

const SCRIPTS_DIR = join(import.meta.dir, "..");

// Each database is a file under $STATE/dbs holding its comment. A
// $STATE/fail-drop-<db> file fails that drop, $STATE/fail-template fails a
// template copy, $STATE/fail-comment fails tagging a database, and
// $STATE/fail-restore fails a restore; $STATE/hold-drop-<db>, $STATE/hold-install
// and $STATE/hold-template, which holds after the copy exists, block until
// removed, touching *-reached first.
const STUBS: Record<string, string> = {
  bun: `
    if [ "$1" = install ]; then
      if [ -e "$STATE/hold-install" ]; then
        touch "$STATE/hold-install-reached"
        while [ -e "$STATE/hold-install" ]; do sleep 0.1; done
      fi
      exit 0
    fi
    exec "$REAL_BUN" "$@"`,
  psql: `
    sql=""
    while [ $# -gt 0 ]; do
      case "$1" in -c|-tAc) sql="$2"; shift 2 ;; *) shift ;; esac
    done
    if [ -z "$sql" ]; then
      cat >/dev/null
      [ -e "$STATE/fail-restore" ] && exit 3
      exit 0
    fi
    db=$(printf '%s' "$sql" | sed -n "s/.*datname='\\([^']*\\)'.*/\\1/p")
    case "$sql" in
      "SELECT 1") echo 1 ;;
      "COMMENT ON DATABASE"*)
        [ -e "$STATE/fail-comment" ] && exit 1
        db=$(printf '%s' "$sql" | sed -n 's/^COMMENT ON DATABASE "\\([^"]*\\)".*/\\1/p')
        printf '%s' "$sql" | sed -n "s/.* IS '\\([^']*\\)'$/\\1/p" | tr -d '\\n' > "$STATE/dbs/$db" ;;
      "ALTER DATABASE"*)
        from=$(printf '%s' "$sql" | sed -n 's/^ALTER DATABASE "\\([^"]*\\)".*/\\1/p')
        to=$(printf '%s' "$sql" | sed -n 's/.* RENAME TO "\\([^"]*\\)"$/\\1/p')
        [ -e "$STATE/dbs/$to" ] && { echo "database \\"$to\\" already exists" >&2; exit 1; }
        mv "$STATE/dbs/$from" "$STATE/dbs/$to" ;;
      *shobj_description*) [ -f "$STATE/dbs/$db" ] && echo "comment:$(cat "$STATE/dbs/$db")" ;;
      *"FROM pg_database"*) [ -f "$STATE/dbs/$db" ] && echo 1 ;;
    esac
    exit 0`,
  createdb: `
    template=""
    case " $* " in *" -T "*) template=1; [ -e "$STATE/fail-template" ] && exit 1 ;; esac
    set -- $(for a in "$@"; do printf '%s\\n' "$a"; done | awk 'skip { skip = 0; next } /^-[hpUT]$/ { skip = 1; next } { print }')
    [ -e "$STATE/dbs/$1" ] && { echo "database $1 exists" >&2; exit 1; }
    : > "$STATE/dbs/$1"
    if [ -n "$template" ] && [ -e "$STATE/hold-template" ]; then
      touch "$STATE/hold-template-reached"
      while [ -e "$STATE/hold-template" ]; do sleep 0.1; done
    fi`,
  dropdb: `
    for db in "$@"; do :; done
    if [ -e "$STATE/hold-drop-$db" ]; then
      touch "$STATE/hold-drop-$db-reached"
      while [ -e "$STATE/hold-drop-$db" ]; do sleep 0.1; done
    fi
    [ -e "$STATE/fail-drop-$db" ] && { echo "drop of $db failed" >&2; exit 1; }
    rm -f "$STATE/dbs/$db"`,
  pg_dump: "exit 0",
};

export type RunResult = { exitCode: number; stdout: string; stderr: string };

export class WorktreeFixture {
  readonly root: string;
  readonly main: string;
  readonly state: string;
  private readonly bin: string;

  constructor(params: { mainDirName: string } = { mainDirName: "alliance" }) {
    this.root = realpathSync(mkdtempSync(join(tmpdir(), "worktree-")));
    this.main = join(this.root, params.mainDirName);
    this.bin = join(this.root, "bin");
    this.state = join(this.root, "state");
    mkdirSync(this.main);
    mkdirSync(this.bin);
    mkdirSync(join(this.state, "dbs"), { recursive: true });

    for (const [name, body] of Object.entries(STUBS)) {
      writeFileSync(join(this.bin, name), `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(join(this.bin, name), 0o755);
    }

    fixtureGit(this.main, "init", "-q", "-b", "main");
    symlinkSync(SCRIPTS_DIR, join(this.main, "scripts"));
    writeFileSync(
      join(this.main, ".gitignore"),
      ".worktree/\nserver/.env\nignored.txt\n",
    );
    fixtureGit(this.main, "add", ".");
    fixtureGit(this.main, "commit", "-qm", "initial");

    mkdirSync(join(this.main, "server"));
    writeFileSync(
      join(this.main, "server", ".env"),
      "DB_HOST=localhost\nDB_PORT=5432\nDB_USERNAME=fixture\nDB_NAME=fixture_main\nSOURCE=main\n",
    );
    writeFileSync(join(this.state, "dbs", "fixture_main"), "");
  }

  cleanup(): void {
    spawnSync("chmod", ["-R", "u+w", this.root]);
    rmSync(this.root, { recursive: true, force: true });
  }

  dir(name: string): string {
    return join(this.root, `alliance-${name}`);
  }

  private env(): Record<string, string> {
    return {
      PATH: `${this.bin}:${process.env.PATH}`,
      HOME: this.root,
      STATE: this.state,
      REAL_BUN: process.execPath,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    };
  }

  private command(params: { script: string; args: string[]; cwd?: string }) {
    const cwd = params.cwd ?? this.main;
    return ["bash", join(cwd, "scripts", params.script), ...params.args];
  }

  run(params: { script: string; args: string[]; cwd?: string }): RunResult {
    const [command, ...args] = this.command(params);
    const result = spawnSync(command, args, {
      cwd: params.cwd ?? this.main,
      env: this.env(),
      encoding: "utf8",
    });
    return {
      exitCode: result.status ?? -1,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  private spawned = 0;

  spawn(params: { script: string; args: string[]; cwd?: string }) {
    const base = join(this.state, `spawn-${++this.spawned}`);
    const proc = Bun.spawn(this.command(params), {
      cwd: params.cwd ?? this.main,
      env: this.env(),
      stdout: Bun.file(`${base}.out`),
      stderr: Bun.file(`${base}.err`),
    });
    const read = (stream: "out" | "err") =>
      existsSync(`${base}.${stream}`)
        ? readFileSync(`${base}.${stream}`, "utf8")
        : "";
    const result = (async (): Promise<RunResult> => ({
      exitCode: await proc.exited,
      stdout: read("out"),
      stderr: read("err"),
    }))();
    const stderrContains = async (text: string): Promise<void> => {
      while (!read("err").includes(text)) {
        if (proc.exitCode !== null) {
          throw new Error(`exited without printing "${text}": ${read("err")}`);
        }
        await Bun.sleep(50);
      }
    };
    return { proc, result, stderrContains };
  }

  create(
    name: string,
    params: { cwd?: string; args?: string[] } = {},
  ): RunResult {
    return this.run({
      script: "new-worktree.sh",
      args: [name, ...(params.args ?? [])],
      cwd: params.cwd,
    });
  }

  remove(args: string[], cwd?: string): RunResult {
    return this.run({ script: "rm-worktree.sh", args, cwd });
  }

  /** A worktree as new-worktree.sh made it before records, claiming `slot` in ports.json or, with `envOnly`, in .worktree/env. */
  addUnrecorded(params: { name: string; slot: number; envOnly?: boolean }) {
    const { name, slot } = params;
    const dir = this.dir(name);
    fixtureGit(this.main, "worktree", "add", "-q", "-b", name, dir);
    mkdirSync(join(dir, ".worktree"));
    if (params.envOnly) {
      writeFileSync(
        join(dir, ".worktree", "env"),
        `export ALLIANCE_PORT_SLOT=${slot}\nexport ALLIANCE_DB_NAME=alliance_${name}\nexport TEST_DB_NAME=alliance_${name}_test\n`,
      );
    } else {
      writeFileSync(
        join(dir, ".worktree", "ports.json"),
        JSON.stringify({
          name,
          slot,
          server: 3005 + slot * 100,
          frontend: 5173 + slot * 100,
          admin: 5174 + slot * 100,
          mobile: 8085 + slot * 100,
          database: `alliance_${name}`,
          testDatabase: `alliance_${name}_test`,
        }),
      );
    }
    writeFileSync(join(this.state, "dbs", `alliance_${name}`), "");
    writeFileSync(join(this.state, "dbs", `alliance_${name}_test`), "");
  }

  git(cwd: string, ...args: string[]): string {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    return result.stdout.trim();
  }

  commit(cwd: string, file: string): void {
    writeFileSync(join(cwd, file), file);
    fixtureGit(cwd, "add", file);
    fixtureGit(cwd, "commit", "-qm", file);
  }

  branchExists(branch: string): boolean {
    return this.git(this.main, "branch", "--list", branch) !== "";
  }

  databases(): string[] {
    return readdirSync(join(this.state, "dbs")).sort();
  }

  dbComment(db: string): string {
    return readFileSync(join(this.state, "dbs", db), "utf8");
  }

  stagingDb(name: string): string {
    return `alliance_wt_${this.record(name).id.replaceAll("-", "")}`;
  }

  instanceId(name: string): string {
    const gitDir = this.git(this.dir(name), "rev-parse", "--absolute-git-dir");
    return readFileSync(join(gitDir, "alliance-instance"), "utf8").trim();
  }

  instances(): string {
    return join(this.main, ".git", "alliance-worktrees", "instances");
  }

  records(): Record<string, string>[] {
    const dir = this.instances();
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((id) => !id.startsWith("."))
      .map((id) => ({
        id,
        ...Object.fromEntries(
          readFileSync(join(dir, id, "record"), "utf8")
            .trim()
            .split("\n")
            .map((line) => {
              const at = line.indexOf("=");
              return [line.slice(0, at), line.slice(at + 1)];
            }),
        ),
      }));
  }

  record(name: string): Record<string, string> {
    const found = this.records().find((r) => r.name === name);
    if (!found) throw new Error(`no record for ${name}`);
    return found;
  }

  recordPath(name: string): string {
    return join(this.instances(), this.record(name).id, "record");
  }

  gone(name: string): boolean {
    return (
      !existsSync(this.dir(name)) &&
      !this.records().some((r) => r.name === name) &&
      !this.databases().some((db) => db.startsWith(`alliance_${name}`)) &&
      !this.branchExists(name)
    );
  }

  flaggedForRemoval(name: string): boolean {
    return readdirSync(join(this.instances(), this.record(name).id)).includes(
      "removing",
    );
  }

  touch(file: string): void {
    writeFileSync(join(this.state, file), "");
  }

  release(file: string): void {
    rmSync(join(this.state, file), { force: true });
  }

  async reached(file: string, proc: Subprocess): Promise<void> {
    while (!existsSync(join(this.state, `${file}-reached`))) {
      if (proc.exitCode !== null) {
        throw new Error(`exited ${proc.exitCode} before reaching ${file}`);
      }
      await Bun.sleep(50);
    }
  }
}
