/*
 * The parts of the provenance CLI that are pure functions of their input, split
 * out so they can be tested without a store or a git repo. See scripts/prov.ts.
 */
import { relative, resolve } from "node:path";
import { R, type Result } from "../../common/src/result";

export type Components = Record<
  string,
  { description?: string; paths: string[] }
>;

/*
 * "go with your recommendation" authorizes a decision without stating one, so
 * promoting it to human evidence would launder an agent's choice into a
 * requirement. Matched word by word rather than against whole phrases, because
 * the phrasings are endless: "sounds good", "yeah sounds good" and "sounds good
 * to me" all have to land in the same place.
 *
 * Deliberately incomplete, and safe to leave that way: the floor below catches
 * the phrasing this list has never heard of. Add a word when you meet one; a
 * missing word is not a hole.
 */
const APPROVAL = new Set([
  "agree",
  "agreed",
  "ahead",
  "approve",
  "approved",
  "awesome",
  "best",
  "board",
  "call",
  "carry",
  "choice",
  "complaints",
  "concerns",
  "continue",
  "cool",
  "correct",
  "discretion",
  "do",
  "either",
  "exactly",
  "fine",
  "go",
  "good",
  "great",
  "it",
  "judgement",
  "judgment",
  "k",
  "let",
  "lets",
  "lgtm",
  "looks",
  "love",
  "makes",
  "nice",
  "objection",
  "objections",
  "ok",
  "okay",
  "on",
  "perfect",
  "please",
  "prefer",
  "prescribe",
  "proceed",
  "reasonable",
  "rec",
  "recommendation",
  "right",
  "seems",
  "sense",
  "sgtm",
  "ship",
  "sounds",
  "sure",
  "thank",
  "thanks",
  "that",
  "think",
  "this",
  "trust",
  "up",
  "use",
  "whatever",
  "works",
  "y",
  "ya",
  "yea",
  "yeah",
  "yeh",
  "yep",
  "yes",
  "you",
  "your",
  "yup",
]);

/*
 * Carries no meaning on its own, so it neither makes a clause approval nor
 * saves it from being one: "sounds good to me" says what "sounds good" says.
 */
const FILLER = new Set([
  "a",
  "an",
  "as",
  "be",
  "but",
  "by",
  "d",
  "for",
  "i",
  "in",
  "is",
  "just",
  "ll",
  "m",
  "me",
  "my",
  "of",
  "one",
  "re",
  "s",
  "so",
  "t",
  "the",
  "then",
  "thing",
  "things",
  "to",
  "too",
  "us",
  "ve",
  "way",
  "well",
  "with",
]);

export enum Refusal {
  NoWords = "no-words",
  ApprovalOnly = "approval-only",
  TooThin = "too-thin",
}

/*
 * Two words carrying information is the floor a quote has to clear, and it is
 * what makes the vocabulary above safe to leave incomplete. Approval is short —
 * "let's do it", "yup", "no objections", "+1" — so a phrasing the list misses
 * runs out of content words instead of slipping through. Human records are
 * append-only, so the two mistakes cost differently: refusing a real
 * requirement costs one retry with more of the sentence quoted, while
 * recording an approval leaves an agent's own choice standing as a requirement
 * forever. Refuse when in doubt.
 */
const INFORMATION_FLOOR = 2;

export function checkQuote(quote: string): Result<string, Refusal> {
  const clauses = quote
    .toLowerCase()
    .replace(/[^a-z0-9\s.,;]/g, " ")
    .replace(/[ \t]+/g, " ")
    .split(/[.,;\n]+|\s+and\s+/)
    .map((clause) =>
      clause
        .split(" ")
        .filter(Boolean)
        .filter((word) => !FILLER.has(word)),
    )
    .filter((words) => words.length > 0);

  if (clauses.length === 0) return R.failure(Refusal.NoWords);
  if (clauses.every((words) => words.every((word) => APPROVAL.has(word))))
    return R.failure(Refusal.ApprovalOnly);

  const carrying = new Set(
    clauses.flat().filter((word) => !APPROVAL.has(word)),
  );
  return carrying.size < INFORMATION_FLOOR
    ? R.failure(Refusal.TooThin)
    : R.success(quote);
}

export function splitTarget(target: string): [string, string | null] {
  const match = /^(.*):(\d+(?:-\d+)?)$/.exec(target);
  if (!match) return [target, null];
  const [, path, range] = match;
  const [start, end] = range!.split("-");
  return [path!, `${start},${end ?? start}`];
}

/*
 * components.yaml globs are repo-relative and callers pass whatever spelling
 * they have, often absolute. Globbing one against the other answers "nothing is
 * scoped here" for a path several decisions cover, so every target is
 * normalized before it reaches a glob or git.
 */
export function repoRelative(params: {
  root: string;
  cwd: string;
  target: string;
}): string {
  const path = relative(params.root, resolve(params.cwd, params.target));
  if (!path || path === ".." || path.startsWith("../"))
    throw new Error(`${params.target} is outside the repo`);
  return path;
}

export function componentsFor(params: {
  path: string;
  components: Components;
}): string[] {
  return Object.entries(params.components)
    .filter(([, component]) =>
      component.paths.some((glob) => new Bun.Glob(glob).match(params.path)),
    )
    .map(([name]) => name);
}

export type CommitProvenance = {
  sha: string;
  subject: string;
  changes: string[];
};

export const COMMIT_FORMAT =
  "%H%x1f%s%x1f%(trailers:key=Provenance,valueonly=true,separator=%x1d)%x1e";

export function parseCommits(out: string): CommitProvenance[] {
  return out
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, subject, trailers] = entry.split("\x1f");
      return {
        sha: sha!,
        subject: subject!,
        changes: (trailers ?? "")
          .split("\x1d")
          .map((value) => value.trim())
          .filter(Boolean),
      };
    });
}

export const HISTORY_FORMAT = "%x1e%h";

export function parseFileHistory(out: string): Map<string, string[]> {
  const history = new Map<string, string[]>();
  for (const entry of out.split("\x1e")) {
    const [sha, ...paths] = entry.split("\n").filter(Boolean);
    if (!sha) continue;
    for (const path of paths)
      history.set(path, [...(history.get(path) ?? []), sha]);
  }

  return history;
}
