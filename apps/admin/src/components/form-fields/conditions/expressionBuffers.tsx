import type {
  FormulaNode,
  VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { createContext, useContext, useState, type ReactNode } from "react";
import { sameFormula } from "./conditionFormula";

/**
 * Expression text as the admin typed it, and the formula the schema holds
 * beside it (null for none): what the text saved, or the formula it left in
 * place while it doesn't parse or names a missing rule.
 */
export type ExpressionBuffer = { text: string; formula: FormulaNode | null };

type VisibilityTarget = { visibleIfFormula?: VisibleIfFormula };

const sameOrNone = (a: FormulaNode | null, b: FormulaNode | null) =>
  a === null || b === null ? a === b : sameFormula(a, b);

const typedText = (
  buffer: ExpressionBuffer | undefined,
  target: VisibilityTarget,
): string | null =>
  buffer && sameOrNone(buffer.formula, target.visibleIfFormula?.formula ?? null)
    ? buffer.text
    : null;

export type ExpressionBuffersValue = {
  buffers: Readonly<Record<string, ExpressionBuffer>>;
  setBuffer: (key: string, buffer: ExpressionBuffer | null) => void;
};

const MISSING_SCOPE = "Condition editors need an expression buffer and scope";

export const ExpressionBuffersContext =
  createContext<ExpressionBuffersValue | null>(null);

/**
 * Which condition editor is inside, and the key of its buffer: an element by
 * page and id, a list sub-field within its list, a page, a group, or an
 * output-view block.
 */
export const ExpressionScope = createContext<string | null>(null);

/**
 * Buffers kept in component state rather than the draft, so they last as
 * long as the mount and add no undo steps.
 */
export function LocalExpressionBuffers({ children }: { children: ReactNode }) {
  const [buffers, setBuffers] = useState<Record<string, ExpressionBuffer>>({});
  const setBuffer = (key: string, buffer: ExpressionBuffer | null) =>
    setBuffers(({ [key]: _replaced, ...rest }) =>
      buffer ? { ...rest, [key]: buffer } : rest,
    );
  return (
    <ExpressionBuffersContext.Provider value={{ buffers, setBuffer }}>
      <ExpressionScope.Provider value="local">
        {children}
      </ExpressionScope.Provider>
    </ExpressionBuffersContext.Provider>
  );
}

/**
 * Scopes the condition editors of one element within `parent`, or within the
 * enclosing scope. An element without an id has no key that stays its own,
 * so its text stays out of the draft and lasts only while it is mounted.
 */
export function ElementExpressionScope({
  parent,
  id,
  children,
}: {
  parent?: string;
  id: string | undefined;
  children: ReactNode;
}) {
  const enclosing = useContext(ExpressionScope);
  const base = parent ?? enclosing;
  if (!id) return <LocalExpressionBuffers>{children}</LocalExpressionBuffers>;
  return (
    <ExpressionScope.Provider value={base === null ? null : `${base}/${id}`}>
      {children}
    </ExpressionScope.Provider>
  );
}

/**
 * The typed text of the expression editing `target`'s visibility, or null
 * when the editor shows the schema's formula. Text whose formula the schema
 * no longer holds, as after an Apply JSON, reads as null.
 */
export function useExpressionBuffer(
  target: VisibilityTarget,
): [string | null, (buffer: ExpressionBuffer | null) => void] {
  const context = useContext(ExpressionBuffersContext);
  const key = useContext(ExpressionScope);
  if (!context || key === null) {
    throw new Error(MISSING_SCOPE);
  }
  return [
    typedText(context.buffers[key], target),
    (next) => context.setBuffer(key, next),
  ];
}

/**
 * For a visibility toggle around the enclosing scope's editor: whether the
 * editor has typed text to show, so the toggle opens on it, and a way to drop
 * the text when visibility is turned off.
 */
export function useTypedExpression(target: VisibilityTarget): {
  typed: boolean;
  clear: () => void;
} {
  const context = useContext(ExpressionBuffersContext);
  const key = useContext(ExpressionScope);
  return {
    typed:
      !!context &&
      key !== null &&
      typedText(context.buffers[key], target) !== null,
    clear: () => {
      if (!context || key === null) {
        throw new Error(MISSING_SCOPE);
      }
      context.setBuffer(key, null);
    },
  };
}
