import { BinaryOp, ExprKind, children, type Expr } from "./tree";

/**
 * The parts of `expr` an evaluation may skip: each branch of `?:` and the
 * fallback of `??`, each node's branches before those nested in them. Named
 * expressions it reads are not followed.
 */
export function branches(expr: Expr): Expr[] {
  const found: Expr[] = [];
  const visit = (node: Expr) => {
    if (node.kind === ExprKind.Conditional) {
      found.push(node.consequent, node.alternate);
    } else if (node.kind === ExprKind.Binary && node.op === BinaryOp.Coalesce) {
      found.push(node.right);
    }
    children(node).forEach(visit);
  };
  visit(expr);
  return found;
}
