import { R, type Result } from "../result";
import {
  type Catalog,
  type Diagnostic,
  type NamedExpression,
  type Scope,
} from "./catalog";
import {
  Undecided,
  checkExpression,
  printNames,
  type ResultRule,
} from "./check";
import { INTERNAL_PREFIX } from "./check-world";
import {
  NameRuleBreak,
  ScopeHolder,
  nameRuleBreak,
  scopeNames,
} from "./convert-scope";
import { reads } from "./dependencies";
import { parseExpression } from "./parse";
import { printExpression } from "./print";
import { ExprKind, type Expr } from "./tree";

/**
 * An expression other than a named one, such as a split group's condition or a
 * form rule: its stored tree, or the admin's text or tree when fixed in this
 * save.
 */
export type Dependent = { id: string; rule: ResultRule } & (
  | { stored: Expr }
  | { fixed: string | Expr }
);

export type FixedDependent = { id: string; tree: Expr };

/**
 * A new named expression, or a new version of a stored one; `source` is the
 * admin's text or a tree.
 */
export type NamedSave = { id: string; name: string; source: string | Expr };

export enum SaveProblemKind {
  Name = "name",
  /** In a named expression. */
  Named = "named",
  Dependent = "dependent",
}

export type SaveProblem =
  | { kind: SaveProblemKind.Name; id: string; message: string }
  | {
      kind: SaveProblemKind.Named | SaveProblemKind.Dependent;
      id: string;
      /**
       * What `diagnostics` are located in: the admin's text, or the tree
       * printed with the names as they are after the save.
       */
      text: string;
      diagnostics: Diagnostic[];
    };

type CheckParams = {
  kind: SaveProblemKind.Named | SaveProblemKind.Dependent;
  id: string;
  source: string | Expr;
  rule: ResultRule;
  skip?: ReadonlySet<string>;
  stored?: boolean;
};

const NAMED_RULE: ResultRule = { undecided: Undecided.Allowed };

/**
 * Checks saving `save` and deleting `deleted` against the stored `named`
 * expressions: each saved expression on its own, then every fixed dependent,
 * and every named expression and stored dependent that reads one saved
 * or deleted, directly or through others. A problem is reported once, at the
 * expression it is in, so a dependent that fails only through a named
 * expression it reads isn't listed, and a broken named expression a checked
 * one reads is listed whether or not the save broke it. On success, returns
 * the saved named expressions and the fixed dependents as trees.
 */
export function checkNamedSave({
  catalog,
  named,
  dependents = [],
  save,
  deleted = [],
}: {
  catalog: Catalog;
  named: readonly NamedExpression[];
  dependents?: readonly Dependent[];
  save: readonly NamedSave[];
  deleted?: readonly string[];
}): Result<
  { named: NamedExpression[]; dependents: FixedDependent[] },
  SaveProblem[]
> {
  const changed = new Set([...save.map((each) => each.id), ...deleted]);
  if (changed.size < save.length + deleted.length) {
    throw new Error(
      "A named expression appears more than once across `save` and `deleted`.",
    );
  }
  if (new Set(dependents.map((each) => each.id)).size < dependents.length) {
    throw new Error("A dependent appears more than once in `dependents`.");
  }
  const storedIds = new Set(named.map((each) => each.id));
  if (deleted.some((id) => !storedIds.has(id))) {
    throw new Error("A deleted id names no stored named expression.");
  }
  const kept = named.filter((each) => !changed.has(each.id));

  const nameProblems = save.flatMap((each): SaveProblem[] => {
    const message = nameProblem(each.name, {
      catalog,
      others: [...kept, ...save.filter((other) => other !== each)],
    });
    return message === undefined
      ? []
      : [{ kind: SaveProblemKind.Name, id: each.id, message }];
  });
  if (nameProblems.length > 0) return R.failure(nameProblems);

  // The parser reads only names from the scope.
  const placeholder: Expr = { kind: ExprKind.Literal, value: null };
  const parseScope = {
    catalog,
    named: [
      ...kept,
      ...save.map(({ id, name }) => ({ id, name, tree: placeholder })),
    ],
  };
  const problems = new Problems();
  const saved: NamedExpression[] = [];
  for (const { id, name, source } of save) {
    const parsed = parseSource(source, parseScope);
    if (parsed.ok) saved.push({ id, name, tree: parsed.value });
    else problems.add({ kind: SaveProblemKind.Named, id, ...parsed.error });
  }
  if (!problems.empty) return R.failure(problems.list());

  const scope = { catalog, named: [...kept, ...saved] };
  // A fallback the save makes needless doesn't block a stored expression,
  // which still gives what it gave; what the admin saves or fixes is told.
  const keptIds = new Set(kept.map((each) => each.id));
  const byName = new Map(scope.named.map((each) => [each.name, each]));
  const deletedNames = new Map(
    named
      .filter((each) => deleted.includes(each.id))
      .map((each) => [each.id, each.name]),
  );
  const names = printNames({ scope, deletedNames });
  const print = (tree: Expr) => printExpression(tree, names);
  const check = (params: CheckParams & { cut?: ReadonlySet<string> }) => {
    const result = checkExpression({
      source: params.source,
      scope:
        params.cut === undefined
          ? scope
          : {
              catalog,
              named: scope.named.map((each) =>
                params.cut?.has(each.id)
                  ? { ...each, tree: placeholder }
                  : each,
              ),
            },
      rule: params.rule,
      stored: { root: params.stored ?? false, named: keptIds },
      deletedNames,
    });
    if (result.ok) return;
    for (const { namedExpression, ...diagnostic } of result.error) {
      const owner =
        namedExpression === undefined ? undefined : byName.get(namedExpression);
      if (owner === undefined) {
        problems.add({
          kind: params.kind,
          id: params.id,
          text:
            typeof params.source === "string"
              ? params.source
              : print(params.source),
          diagnostics: [diagnostic],
        });
      } else if (!params.skip?.has(owner.id)) {
        problems.add({
          kind: SaveProblemKind.Named,
          id: owner.id,
          text: print(owner.tree),
          diagnostics: [diagnostic],
        });
      }
    }
  };

  const readsOf = (tree: Expr) => reads(tree, scope.named).named;
  const onLoop = new Set(
    scope.named
      .filter((each) => readsOf(each.tree).has(each.id))
      .map(({ id }) => id),
  );
  // A loop is reported by the named expressions on it, not by those reading
  // into it, so a check reaching a loop it isn't on checks the stored ones on
  // that loop in its place, unless a saved one on it reports it. One on a loop
  // is checked with the loops it only reads into cut, so it reports its own.
  const onSavedLoop = (each: NamedExpression) => {
    const eachReads = readsOf(each.tree);
    return saved.some(
      (other) => eachReads.has(other.id) && readsOf(other.tree).has(each.id),
    );
  };
  const checkRoot = (params: CheckParams & { tree: Expr }) => {
    const rootReads = readsOf(params.tree);
    const onOwnLoop =
      params.kind === SaveProblemKind.Named && onLoop.has(params.id);
    const loops = new Set(
      scope.named
        .filter(
          (each) =>
            rootReads.has(each.id) &&
            onLoop.has(each.id) &&
            !(onOwnLoop && readsOf(each.tree).has(params.id)),
        )
        .map(({ id }) => id),
    );
    if (loops.size === 0) check(params);
    else if (onOwnLoop) check({ ...params, cut: loops });
    for (const each of kept) {
      if (!loops.has(each.id) || onSavedLoop(each)) continue;
      checkRoot({
        kind: SaveProblemKind.Named,
        id: each.id,
        source: each.tree,
        tree: each.tree,
        rule: NAMED_RULE,
        skip: params.skip,
        stored: true,
      });
    }
  };

  // A saved expression's own check locates its problems in the admin's text,
  // where another's check would locate them in its printed tree.
  const savedIds = new Set(save.map((each) => each.id));
  save.forEach(({ id, source }, i) =>
    checkRoot({
      kind: SaveProblemKind.Named,
      id,
      source,
      tree: saved[i].tree,
      rule: NAMED_RULE,
      skip: savedIds,
    }),
  );
  if (!problems.empty) return R.failure(problems.list());

  const readsChanged = (tree: Expr) =>
    [...readsOf(tree)].some((id) => changed.has(id));
  for (const each of kept) {
    if (!readsChanged(each.tree)) continue;
    checkRoot({
      kind: SaveProblemKind.Named,
      id: each.id,
      source: each.tree,
      tree: each.tree,
      rule: NAMED_RULE,
      stored: true,
    });
  }
  const fixed: FixedDependent[] = [];
  for (const each of dependents) {
    const { id, rule } = each;
    if ("stored" in each) {
      if (readsChanged(each.stored)) {
        checkRoot({
          kind: SaveProblemKind.Dependent,
          id,
          source: each.stored,
          tree: each.stored,
          rule,
          stored: true,
        });
      }
      continue;
    }
    const tree = parseSource(each.fixed, scope);
    if (!tree.ok) {
      problems.add({ kind: SaveProblemKind.Dependent, id, ...tree.error });
      continue;
    }
    fixed.push({ id, tree: tree.value });
    checkRoot({
      kind: SaveProblemKind.Dependent,
      id,
      source: each.fixed,
      tree: tree.value,
      rule,
    });
  }
  return problems.empty
    ? R.success({ named: saved, dependents: fixed })
    : R.failure(problems.list());
}

function parseSource(
  source: string | Expr,
  scope: Scope,
): Result<Expr, { text: string; diagnostics: Diagnostic[] }> {
  return typeof source === "string"
    ? R.mapError(parseExpression(source, scope), (diagnostics) => ({
        text: source,
        diagnostics,
      }))
    : R.success(source);
}

class Problems {
  private readonly byOwner = new Map<
    string,
    Extract<SaveProblem, { diagnostics: Diagnostic[] }>
  >();

  get empty(): boolean {
    return this.byOwner.size === 0;
  }

  add({
    kind,
    id,
    text,
    diagnostics,
  }: Extract<SaveProblem, { diagnostics: Diagnostic[] }>): void {
    const key = `${kind}:${id}`;
    const problem = this.byOwner.get(key) ?? {
      kind,
      id,
      text,
      diagnostics: [],
    };
    this.byOwner.set(key, problem);
    for (const diagnostic of diagnostics) {
      const seen = problem.diagnostics.some(
        (other) =>
          other.message === diagnostic.message &&
          other.start === diagnostic.start &&
          other.end === diagnostic.end,
      );
      if (!seen) problem.diagnostics.push(diagnostic);
    }
  }

  list(): SaveProblem[] {
    return [...this.byOwner.values()];
  }
}

const HOLDER_WORDS: Record<ScopeHolder, string> = {
  [ScopeHolder.Function]: "a function",
  [ScopeHolder.Input]: "something formulas can read",
  [ScopeHolder.Named]: "another formula",
};

function nameProblem(
  name: string,
  {
    catalog,
    others,
  }: { catalog: Catalog; others: readonly { name: string }[] },
): string | undefined {
  if (name === "") return "Enter a name.";
  const holders = new Map(
    scopeNames({ catalog, named: others }).map((each) => [
      each.name,
      HOLDER_WORDS[each.holder],
    ]),
  );
  const broken = nameRuleBreak(name, new Set(holders.keys()));
  switch (broken) {
    case undefined:
      return undefined;
    case NameRuleBreak.Unreadable:
    case NameRuleBreak.Undeclarable:
      return `\`${name}\` can't be a name. Use letters, digits, \`_\` and \`$\`, don't start with a digit, and avoid words the language keeps for itself.`;
    case NameRuleBreak.Internal:
      return `A name can't start with \`${INTERNAL_PREFIX}\`.`;
    case NameRuleBreak.Taken:
      return `\`${name}\` is already used by ${holders.get(name) ?? "the language"}. Pick another name.`;
    default:
      throw new Error(`unknown name rule break: ${broken satisfies never}`);
  }
}
