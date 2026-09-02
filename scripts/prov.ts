/*
 * Provenance store: what a human explicitly asked for, what an agent decided,
 * and the change episodes that tie both to commits. See .provenance/SPEC.md.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import { R, type Result } from "../common/src/result";
import {
  checkQuote,
  COMMIT_FORMAT,
  componentsFor,
  HISTORY_FORMAT,
  parseCommits,
  parseFileHistory,
  Refusal,
  repoRelative,
  splitTarget,
  type CommitProvenance,
} from "./lib/provenance";

const REPO_ROOT = join(import.meta.dir, "..");
const PROV_DIR = join(REPO_ROOT, ".provenance");
const HUMAN_DIR = join(PROV_DIR, "human");
const DECISION_DIR = join(PROV_DIR, "decisions");
const CHANGE_DIR = join(PROV_DIR, "changes");
const UNCOMMITTED_SHA = "0".repeat(40);

enum Kind {
  Human = "human",
  Decision = "decision",
  Reconstruction = "reconstruction",
  Change = "change",
}

enum Authority {
  DelegatedDiscretion = "delegated-discretion",
  AgentJudgment = "agent-judgment",
}

enum Confidence {
  Low = "low",
  Medium = "medium",
  High = "high",
}

const id = z.string().regex(/^pv_[0-9a-f-]{36}$/);
const common = { id };

/*
 * Each record names its change, rather than the change listing its records. Two
 * agents recording in parallel then only ever write their own new file, where
 * appending to a shared list drops every write but the last.
 */
const humanSchema = z.object({
  ...common,
  kind: z.literal(Kind.Human),
  created_at: z.string(),
  change: id,
  source: z.string().min(1),
  supersedes: z.array(id).default([]),
  quote: z.string().min(1),
});

const decisionSchema = z.object({
  ...common,
  kind: z.literal(Kind.Decision),
  created_at: z.string(),
  change: id,
  summary: z.string().min(1),
  authority: z.enum(Authority),
  applies_to: z.array(z.string()).default([]),
  supersedes: z.array(id).default([]),
  detail: z.string().optional(),
});

const reconstructionSchema = z.object({
  ...common,
  kind: z.literal(Kind.Reconstruction),
  created_at: z.string(),
  change: id.optional(),
  summary: z.string().min(1),
  confidence: z.enum(Confidence),
  applies_to: z.array(z.string()).default([]),
  supersedes: z.array(id).default([]),
  detail: z.string().optional(),
});

const decisionFileSchema = z.discriminatedUnion("kind", [
  decisionSchema,
  reconstructionSchema,
]);

const changeSchema = z.object({
  ...common,
  kind: z.literal(Kind.Change),
  created_at: z.string(),
  title: z.string().min(1),
});

const componentsSchema = z.record(
  z.string(),
  z.object({
    description: z.string().optional(),
    paths: z.array(z.string()).min(1),
  }),
);

const baselineSchema = z.object({
  introduced_at_commit: z.string(),
  policy: z.string(),
});

type HumanRecord = z.infer<typeof humanSchema>;
type DecisionRecord = z.infer<typeof decisionFileSchema>;
type ChangeRecord = z.infer<typeof changeSchema>;
type AnyRecord = HumanRecord | DecisionRecord | ChangeRecord;

type Loaded<T> = { path: string; result: Result<T, string> };

type Store = {
  humans: HumanRecord[];
  decisions: DecisionRecord[];
  changes: Map<string, ChangeRecord>;
  supersededBy: Map<string, string>;
};

function newId(): string {
  return `pv_${Bun.randomUUIDv7()}`;
}

function readYaml<T>(path: string, schema: z.ZodType<T>): Result<T, string> {
  const parsed = R.fromThrowable(() => parseYaml(readFileSync(path, "utf8")));
  if (!parsed.ok) return R.failure(`${path}: ${parsed.error.message}`);

  const validated = schema.safeParse(parsed.value);
  return validated.success
    ? R.success(validated.data)
    : R.failure(`${path}: ${z.prettifyError(validated.error)}`);
}

function loadDir<T>(dir: string, schema: z.ZodType<T>): Loaded<T>[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => ({
      path: join(dir, name),
      result: readYaml(join(dir, name), schema),
    }));
}

function loadValid<T>(dir: string, schema: z.ZodType<T>): T[] {
  return loadDir(dir, schema).map(({ result }) => {
    if (!result.ok) throw new Error(result.error);
    return result.value;
  });
}

function write(dir: string, record: AnyRecord): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${record.id}.yaml`);
  writeFileSync(path, stringifyYaml(record, { lineWidth: 0 }));
  return path;
}

function git(args: string[]): string {
  const { stdout, stderr, exitCode } = Bun.spawnSync(["git", ...args], {
    cwd: REPO_ROOT,
  });
  if (exitCode !== 0)
    throw new Error(`git ${args.join(" ")}: ${stderr.toString().trim()}`);
  return stdout.toString();
}

function repoPath(absolute: string): string {
  return absolute.slice(REPO_ROOT.length + 1);
}

function tracked(path: string): boolean {
  return (
    Bun.spawnSync(["git", "ls-files", "--error-unmatch", "--", path], {
      cwd: REPO_ROOT,
    }).exitCode === 0
  );
}

function loadStore(): Store {
  const humans = loadValid(HUMAN_DIR, humanSchema);
  const decisions = loadValid(DECISION_DIR, decisionFileSchema);
  return {
    humans,
    decisions,
    changes: new Map(
      loadValid(CHANGE_DIR, changeSchema).map((record) => [record.id, record]),
    ),
    supersededBy: new Map(
      [...humans, ...decisions].flatMap((record) =>
        record.supersedes.map((id): [string, string] => [id, record.id]),
      ),
    ),
  };
}

function allRecords(): AnyRecord[] {
  const store = loadStore();
  return [...store.humans, ...store.decisions, ...store.changes.values()];
}

function resolve(prefix: string): AnyRecord {
  const normalized = prefix.startsWith("pv_") ? prefix : `pv_${prefix}`;
  const matches = allRecords().filter((record) =>
    record.id.startsWith(normalized),
  );
  if (matches.length === 0)
    throw new Error(`no provenance record matching ${prefix}`);
  if (matches.length > 1) {
    throw new Error(
      `${prefix} matches ${matches.length} records: ${matches.map((m) => m.id).join(", ")}`,
    );
  }

  return matches[0]!;
}

function resolveChange(prefix: string): ChangeRecord {
  const record = resolve(prefix);
  if (record.kind !== Kind.Change)
    throw new Error(`${record.id} is a ${record.kind}, not a change`);
  return record;
}

/*
 * A decision superseding human evidence would be an agent overruling a human,
 * which is the one thing this store exists to rule out. So a record supersedes
 * its own kind only, the two agent kinds counting as one.
 */
const AGENT_KINDS = [Kind.Decision, Kind.Reconstruction];
const SUPERSEDABLE: Record<Kind, Kind[]> = {
  [Kind.Human]: [Kind.Human],
  [Kind.Decision]: AGENT_KINDS,
  [Kind.Reconstruction]: AGENT_KINDS,
  [Kind.Change]: [],
};

function resolveSupersedes(params: {
  prefixes: string[] | undefined;
  kind: Kind;
}): string[] {
  const allowed = SUPERSEDABLE[params.kind];
  return (params.prefixes ?? []).map((prefix) => {
    const record = resolve(prefix);
    if (!allowed.includes(record.kind)) {
      throw new Error(
        `cannot supersede ${record.id}: a ${params.kind} record may only supersede ${allowed.join(" or ")}, and ${record.id} is a ${record.kind}`,
      );
    }

    return record.id;
  });
}

function components() {
  const path = join(PROV_DIR, "components.yaml");
  if (!existsSync(path)) return {};
  const loaded = readYaml(path, componentsSchema);
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.value;
}

function baselineCommit(): string | null {
  const path = join(PROV_DIR, "baseline.yaml");
  if (!existsSync(path)) return null;
  const loaded = readYaml(path, baselineSchema);
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.value.introduced_at_commit;
}

async function stdin(): Promise<string> {
  return process.stdin.isTTY ? "" : (await Bun.stdin.text()).trim();
}

/*
 * Reading stdin unconditionally for an optional field hangs the command
 * whenever stdin is an inherited pipe, which is how an agent's shell runs it.
 * So stdin is read only when the caller spells it: `--detail -`.
 */
async function detailFrom(value: string | undefined): Promise<string> {
  if (value === undefined) return "";
  return value === "-" ? await stdin() : value.trim();
}

const REFUSED: Record<Refusal, string> = {
  [Refusal.NoWords]:
    "there are no words in it.\nRecord what the human actually wrote, or record the choice with:  bun run prov decide <change> --delegated",
  [Refusal.ApprovalOnly]:
    "approving or delegating a choice does not state one.\nThe decision stays an agent decision. Record it with:  bun run prov decide <change> --delegated",
  [Refusal.TooThin]:
    "it carries too little to stand as a requirement once the conversation is gone.\nQuote more of what the human wrote, or record the choice with:  bun run prov decide <change> --delegated",
};

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

enum Command {
  Start = "start",
  Human = "human",
  Decide = "decide",
  Note = "note",
  Context = "context",
  Review = "review",
  Show = "show",
  Lint = "lint",
}

const RUN: Record<Command, (argv: string[]) => Promise<void> | void> = {
  [Command.Start]: (argv) => {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true });
    const record = changeSchema.parse({
      id: newId(),
      kind: Kind.Change,
      created_at: new Date().toISOString(),
      title: required(positionals.join(" ").trim(), "change title"),
    });

    write(CHANGE_DIR, record);
    console.log(record.id);
    console.log(
      `\nRecord the human's own words with:  bun run prov human ${record.id}`,
    );
    console.log(
      `Trailer for every commit of this change:\n\n  Provenance: ${record.id}`,
    );
  },

  [Command.Human]: async (argv) => {
    const { positionals, values } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        source: { type: "string", default: "conversation" },
        supersedes: { type: "string", multiple: true },
      },
    });

    const change = resolveChange(required(positionals[0], "change id"));
    const quote = await stdin();
    if (!quote) throw new Error("pipe the human's exact words on stdin");
    const checked = checkQuote(quote);
    if (!checked.ok)
      throw new Error(
        `refusing to record "${quote}" as human evidence: ${REFUSED[checked.error]}`,
      );

    const record = humanSchema.parse({
      id: newId(),
      kind: Kind.Human,
      created_at: new Date().toISOString(),
      change: change.id,
      source: values.source,
      supersedes: resolveSupersedes({
        prefixes: values.supersedes,
        kind: Kind.Human,
      }),
      quote,
    });

    write(HUMAN_DIR, record);
    console.log(record.id);
  },

  [Command.Decide]: async (argv) => {
    const { positionals, values } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        delegated: { type: "boolean", default: false },
        detail: { type: "string" },
        component: { type: "string", multiple: true },
        supersedes: { type: "string", multiple: true },
      },
    });

    const change = resolveChange(required(positionals[0], "change id"));
    const detail = await detailFrom(values.detail);
    const record = decisionSchema.parse({
      id: newId(),
      kind: Kind.Decision,
      created_at: new Date().toISOString(),
      change: change.id,
      summary: required(
        positionals.slice(1).join(" ").trim(),
        "decision summary",
      ),
      authority: values.delegated
        ? Authority.DelegatedDiscretion
        : Authority.AgentJudgment,
      applies_to: checkComponents(values.component ?? []),
      supersedes: resolveSupersedes({
        prefixes: values.supersedes,
        kind: Kind.Decision,
      }),
      ...(detail ? { detail } : {}),
    });

    write(DECISION_DIR, record);
    console.log(record.id);
  },

  [Command.Note]: async (argv) => {
    const { positionals, values } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        confidence: { type: "string", default: Confidence.Medium },
        detail: { type: "string" },
        component: { type: "string", multiple: true },
        change: { type: "string" },
        supersedes: { type: "string", multiple: true },
      },
    });

    const detail = await detailFrom(values.detail);
    const record = reconstructionSchema.parse({
      id: newId(),
      kind: Kind.Reconstruction,
      created_at: new Date().toISOString(),
      ...(values.change ? { change: resolveChange(values.change).id } : {}),
      summary: required(positionals.join(" ").trim(), "reconstruction summary"),
      confidence: values.confidence,
      applies_to: checkComponents(values.component ?? []),
      supersedes: resolveSupersedes({
        prefixes: values.supersedes,
        kind: Kind.Reconstruction,
      }),
      ...(detail ? { detail } : {}),
    });

    write(DECISION_DIR, record);
    console.log(record.id);
  },

  [Command.Context]: (argv) => {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true });
    const [target, lines] = splitTarget(
      required(positionals[0], "path[:line[-line]]"),
    );
    printContext({
      store: loadStore(),
      path: repoRelative({ root: REPO_ROOT, cwd: process.cwd(), target }),
      lines,
    });
  },

  [Command.Review]: (argv) => {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true });
    printReview({ store: loadStore(), range: positionals[0] ?? "main..HEAD" });
  },

  [Command.Show]: (argv) => {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true });
    console.log(
      stringifyYaml(resolve(required(positionals[0], "record id")), {
        lineWidth: 0,
      }).trimEnd(),
    );
  },

  [Command.Lint]: () => lint(),
};

function checkComponents(names: string[]): string[] {
  const known = components();
  for (const name of names) {
    if (!(name in known)) {
      throw new Error(
        `unknown component "${name}"; declared components: ${Object.keys(known).join(", ")}`,
      );
    }
  }

  return names;
}

function commitProvenance(revs: string[]): CommitProvenance[] {
  if (revs.length === 0) return [];
  return parseCommits(
    git(["show", "-s", `--format=${COMMIT_FORMAT}`, ...revs]),
  );
}

function rangeProvenance(range: string): CommitProvenance[] {
  return parseCommits(git(["log", `--format=${COMMIT_FORMAT}`, range]));
}

/*
 * The files of the commits git log lists, not `git diff <range>`: on a two-dot
 * range those are different sets the moment the base branch moves ahead, and
 * the diff would credit this change with the base branch's own files.
 */
function rangeFiles(range: string): string[] {
  return [
    ...new Set(
      git(["log", "--format=", "--name-only", range])
        .split("\n")
        .filter(Boolean),
    ),
  ].sort();
}

function ancestorsOfBaseline(): Set<string> {
  const baseline = baselineCommit();
  if (!baseline) return new Set();
  return new Set(git(["rev-list", baseline]).split("\n").filter(Boolean));
}

function indent(text: string, prefix: string): string {
  return text
    .trim()
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

function printChange(params: {
  store: Store;
  change: ChangeRecord;
  quoted: Set<string>;
}) {
  const { store, change, quoted } = params;
  console.log(`  change ${change.id}  ${change.title}`);
  for (const human of store.humans.filter(
    (record) => record.change === change.id,
  )) {
    console.log(
      quoted.has(human.id)
        ? `    HUMAN (${human.source})  ${human.id}, quoted above`
        : indent(describeHuman(store, human), "    "),
    );
  }

  for (const decision of store.decisions.filter(
    (record) => record.change === change.id,
  ))
    console.log(`    AGENT ${describeDecision(store, decision)}`);
}

/*
 * A superseded record still prints, because the evidence log is the point. Left
 * unmarked, though, a withdrawn requirement reads exactly like a live one.
 */
function supersededNote(store: Store, id: string): string {
  const by = store.supersededBy.get(id);
  return by ? `  (superseded by ${by})` : "";
}

function describeHuman(store: Store, human: HumanRecord): string {
  return `HUMAN (${human.source})${supersededNote(store, human.id)}\n${human.quote}`;
}

function describeDecision(store: Store, decision: DecisionRecord): string {
  const scope =
    decision.applies_to.length > 0
      ? ` [${decision.applies_to.join(", ")}]`
      : "";
  return `${decision.summary} (${describeAuthority(decision)})${scope}${supersededNote(store, decision.id)}`;
}

function describeAuthority(decision: DecisionRecord): string {
  switch (decision.kind) {
    case Kind.Decision:
      return decision.authority;
    case Kind.Reconstruction:
      return `reconstruction, ${decision.confidence} confidence`;
    default:
      throw new Error(`unknown kind: ${decision satisfies never}`);
  }
}

function printContext(params: {
  store: Store;
  path: string;
  lines: string | null;
}) {
  const { store, path, lines } = params;
  const scopes = componentsFor({ path, components: components() });

  console.log(`${path}${lines ? `:${lines.replace(",", "-")}` : ""}`);
  console.log(
    `\nApplies now  (components: ${scopes.join(", ") || "none declared"})`,
  );
  const applicable = store.decisions
    .filter((decision) =>
      decision.applies_to.some((name) => scopes.includes(name)),
    )
    .filter((decision) => !store.supersededBy.has(decision.id));
  if (applicable.length === 0) console.log("  nothing scoped to this path");
  for (const decision of applicable)
    console.log(`  ${decision.id}  ${describeDecision(store, decision)}`);

  /*
   * A requirement outlives the lines it arrived with, and blame only reaches it
   * while those lines survive. Scoping human evidence through the decisions it
   * produced keeps it in the answer after the code has been rewritten around it.
   */
  const scoped = new Set(
    applicable
      .map((decision) => decision.change)
      .filter((change): change is string => change !== undefined),
  );
  const quoted = new Set<string>();
  for (const human of store.humans.filter((record) =>
    scoped.has(record.change),
  )) {
    console.log(`\n${indent(describeHuman(store, human), "  ")}`);
    quoted.add(human.id);
  }

  const blame = R.fromThrowable(() =>
    git(["blame", "--porcelain", ...(lines ? ["-L", lines] : []), "--", path]),
  );

  console.log("\nHistory");
  if (!blame.ok) {
    console.log(
      tracked(path)
        ? indent(blame.error.message, "  ")
        : `  ${path} is not committed yet, so there is nothing to blame`,
    );
    return;
  }

  const blamed = [
    ...new Set(
      [...blame.value.matchAll(/^([0-9a-f]{40}) \d+ \d+/gm)].map(
        (match) => match[1]!,
      ),
    ),
  ];
  // blame gives uncommitted lines an all-zero sha, which git show cannot read.
  const uncommitted = blamed.includes(UNCOMMITTED_SHA);
  if (uncommitted) console.log("  working tree  uncommitted lines");

  const legacy = ancestorsOfBaseline();
  const commits = commitProvenance(
    blamed.filter((sha) => sha !== UNCOMMITTED_SHA),
  );
  for (const commit of commits) {
    const note =
      commit.changes.length > 0
        ? commit.changes.join(", ")
        : legacy.has(commit.sha)
          ? "(predates the provenance baseline)"
          : "(no provenance recorded)";
    console.log(`  ${commit.sha.slice(0, 8)}  ${commit.subject}  ${note}`);
  }

  /*
   * One block per change, however many of the blamed commits belong to it, and
   * a quote already printed above is named rather than repeated. A long prompt
   * printed once per commit, then again per section, is most of what an agent
   * would read here.
   */
  for (const changeId of new Set(commits.flatMap((commit) => commit.changes))) {
    console.log("");
    const change = store.changes.get(changeId);
    if (!change) {
      console.log(`  unknown change ${changeId}`);
      continue;
    }

    printChange({ store, change, quoted });
  }
}

function printReview(params: { store: Store; range: string }) {
  const { store, range } = params;
  const commits = rangeProvenance(range);
  const referenced = new Set(commits.flatMap((commit) => commit.changes));

  console.log(`Provenance for ${range}\n`);
  console.log("Human requirements\n──────────────────");
  const quotes = store.humans.filter((human) => referenced.has(human.change));
  if (quotes.length === 0) console.log("  none recorded");
  for (const human of quotes) {
    console.log(indent(describeHuman(store, human), "  "));
    console.log("");
  }

  console.log("\nAgent decisions\n───────────────");
  const decided = store.decisions.filter(
    (decision) => decision.change && referenced.has(decision.change),
  );
  if (decided.length === 0) console.log("  none recorded");
  for (const decision of decided)
    console.log(`  ${describeDecision(store, decision)}`);

  /*
   * A trailer naming no change matches no record, so the two sections above
   * would read as "nothing was recorded" when the truth is a broken link.
   */
  const dangling = commits
    .map((commit) => ({
      commit,
      ids: commit.changes.filter((id) => !store.changes.has(id)),
    }))
    .filter(({ ids }) => ids.length > 0);
  if (dangling.length > 0) {
    console.log(
      "\nTrailers naming no known change\n───────────────────────────────",
    );
    for (const { commit, ids } of dangling)
      console.log(
        `  ${commit.sha.slice(0, 8)}  ${commit.subject}  ${ids.join(", ")}`,
      );
  }

  const legacy = ancestorsOfBaseline();
  const untrailered = commits.filter(
    (commit) => commit.changes.length === 0 && !legacy.has(commit.sha),
  );
  if (untrailered.length > 0) {
    console.log(
      "\nCommits with no Provenance trailer\n──────────────────────────────────",
    );
    for (const commit of untrailered)
      console.log(`  ${commit.sha.slice(0, 8)}  ${commit.subject}`);
  }

  console.log("\nFiles\n─────");
  for (const file of rangeFiles(range)) console.log(`  ${file}`);
}

type Reference = { id: string; allowed: Kind[] };

function referencesOf(record: AnyRecord): Reference[] {
  switch (record.kind) {
    case Kind.Change:
      return [];
    case Kind.Human:
    case Kind.Decision:
    case Kind.Reconstruction:
      return [
        ...(record.change
          ? [{ id: record.change, allowed: [Kind.Change] }]
          : []),
        ...record.supersedes.map((id) => ({
          id,
          allowed: SUPERSEDABLE[record.kind],
        })),
      ];
    default:
      throw new Error(`unknown kind: ${record satisfies never}`);
  }
}

/*
 * One pass rather than a git log per record: each of those walks the whole
 * history, on a CI checkout fetched to full depth for this one check.
 */
function humanFileHistory(): Map<string, string[]> {
  return parseFileHistory(
    git([
      "log",
      `--format=${HISTORY_FORMAT}`,
      "--name-only",
      "--",
      repoPath(HUMAN_DIR),
    ]),
  );
}

function lint() {
  const problems: string[] = [];
  const humanFiles = loadDir(HUMAN_DIR, humanSchema);
  const records = new Map<string, AnyRecord>();

  const loaded: Loaded<AnyRecord>[] = [
    ...humanFiles,
    ...loadDir(DECISION_DIR, decisionFileSchema),
    ...loadDir(CHANGE_DIR, changeSchema),
  ];

  for (const { path, result } of loaded) {
    if (!result.ok) {
      problems.push(result.error);
      continue;
    }

    if (!path.endsWith(`/${result.value.id}.yaml`))
      problems.push(
        `${repoPath(path)}: filename does not match id ${result.value.id}`,
      );
    records.set(result.value.id, result.value);
  }

  const known = components();
  for (const record of records.values()) {
    for (const { id: ref, allowed } of referencesOf(record)) {
      const target = records.get(ref);
      if (!target) {
        problems.push(`${record.id}: references unknown record ${ref}`);
      } else if (!allowed.includes(target.kind)) {
        problems.push(
          `${record.id}: references ${ref}, a ${target.kind}, where a ${allowed.join(" or ")} belongs`,
        );
      }
    }
    if (record.kind === Kind.Decision || record.kind === Kind.Reconstruction) {
      for (const name of record.applies_to) {
        if (!(name in known))
          problems.push(`${record.id}: unknown component "${name}"`);
      }
    }
  }

  /*
   * Against the bytes first committed, not against a count of the commits that
   * touched the file: a count calls a revert a second edit, so the store would
   * stay red for good over an accident nobody can undo — human records cannot
   * be edited back into shape. Every path the history ever held, since a
   * committed deletion is already gone from HEAD's tree.
   */
  const committed = humanFileHistory();
  for (const [relative, commits] of committed) {
    const added = commits.at(-1)!;
    const original = R.fromThrowable(() =>
      git(["show", `${added}:${relative}`]),
    );
    if (!original.ok) {
      problems.push(`${relative}: cannot be read back out of ${added}`);
      continue;
    }

    const current = R.fromThrowable(() =>
      readFileSync(join(REPO_ROOT, relative), "utf8"),
    );
    if (!current.ok) {
      problems.push(
        `${relative}: human evidence is append-only but was deleted`,
      );
    } else if (current.value !== original.value) {
      problems.push(
        `${relative}: human evidence is append-only but no longer reads as it did in ${added}`,
      );
    }
  }

  /*
   * Only what is still uncommitted, where the author can still fix it. The
   * approval vocabulary is meant to grow, and a committed record is one nobody
   * is allowed to edit, so judging old records by today's list would brick CI
   * on the day somebody adds a word.
   */
  for (const { path, result } of humanFiles) {
    if (!result.ok) continue;
    const relative = repoPath(path);
    if (committed.has(relative)) continue;
    const checked = checkQuote(result.value.quote);
    if (!checked.ok)
      problems.push(`${relative}: ${REFUSED[checked.error].split("\n")[0]}`);
  }

  for (const problem of problems) console.error(`✗ ${problem}`);
  console.log(`${records.size} records, ${problems.length} problems`);
  if (problems.length > 0) process.exit(1);
}

const [name, ...argv] = process.argv.slice(2);
const command = Object.values(Command).find((candidate) => candidate === name);
if (!command) {
  console.error(`usage: bun run prov <${Object.values(Command).join("|")}>`);
  console.error("see .provenance/SPEC.md");
  process.exit(2);
}

const outcome = await R.fromPromiseFn(() =>
  Promise.resolve(RUN[command](argv)),
);
if (!outcome.ok) {
  console.error(outcome.error.message);
  process.exit(1);
}
