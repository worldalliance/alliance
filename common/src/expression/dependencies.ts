import { R, type Result } from "../result";
import { topologicalOrder } from "../topological-order";
import { IS_MISSING, type NamedExpression } from "./catalog";
import { ExprKind, children, mathFunctionName, type Expr } from "./tree";

export type Reads = {
  inputs: Set<string>;
  functions: Set<string>;
  named: Set<string>;
  lists: Set<string>;
};

function walk(expr: Expr, visit: (node: Expr) => void): void {
  visit(expr);
  for (const child of children(expr)) walk(child, visit);
}

const directRefs = (expr: Expr): Set<string> => reads(expr, []).named;

/**
 * What an expression reads, directly or through the named expressions it
 * references. `Math` functions and `isMissing` aren't counted; a reference to
 * a named expression missing from `named` is listed but not followed.
 */
export function reads(expr: Expr, named: readonly NamedExpression[]): Reads {
  const byId = new Map(named.map((each) => [each.id, each]));
  const found: Reads = {
    inputs: new Set(),
    functions: new Set(),
    named: new Set(),
    lists: new Set(),
  };
  const visit = (node: Expr) => {
    switch (node.kind) {
      case ExprKind.Input:
        found.inputs.add(node.id);
        return;
      case ExprKind.Call:
        if (node.fn !== IS_MISSING && mathFunctionName(node.fn) === undefined) {
          found.functions.add(node.fn);
        }
        return;
      case ExprKind.Ref: {
        if (found.named.has(node.id)) return;
        found.named.add(node.id);
        const definition = byId.get(node.id);
        if (definition !== undefined) walk(definition.tree, visit);
        return;
      }
      case ExprKind.OnList:
        found.lists.add(node.listId);
        return;
      case ExprKind.Literal:
      case ExprKind.Param:
      case ExprKind.List:
      case ExprKind.Record:
      case ExprKind.Template:
      case ExprKind.Unary:
      case ExprKind.Binary:
      case ExprKind.Conditional:
      case ExprKind.Member:
      case ExprKind.Index:
      case ExprKind.Method:
      case ExprKind.Lambda:
        return;
      default:
        throw new Error(`unknown kind: ${node satisfies never}`);
    }
  };
  walk(expr, visit);
  return found;
}

/**
 * The named expressions `roots` reach, each after those it references, or the
 * names along a cycle. References to ids missing from `named` are skipped.
 */
export function dependencyOrder(
  roots: readonly Expr[],
  named: readonly NamedExpression[],
): Result<NamedExpression[], string[]> {
  const byId = new Map(named.map((each) => [each.id, each]));
  return R.mapError(
    topologicalOrder({
      roots: roots.flatMap((root) => [...directRefs(root)]),
      itemOf: (id) => byId.get(id),
      dependenciesOf: (definition) => directRefs(definition.tree),
    }),
    (cycle) => cycle.map((definition) => definition.name),
  );
}
