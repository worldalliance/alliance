import ts from "typescript";

export const FORMULA_TARGET = ts.ScriptTarget.ES2020;

const RENDERABLE_FLAGS =
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown |
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Null |
  ts.TypeFlags.Never;

export function unionParts(type: ts.Type): readonly ts.Type[] {
  return type.isUnion() ? type.types : [type];
}

export function isRenderable(part: ts.Type): boolean {
  return Boolean(part.flags & RENDERABLE_FLAGS);
}

export function unrenderablePart(type: ts.Type): ts.Type | undefined {
  return unionParts(type).find((part) => !isRenderable(part));
}

function canFollowDot(name: string): boolean {
  return (
    name.length > 0 &&
    [...name].every((char, index) =>
      (index === 0 ? ts.isIdentifierStart : ts.isIdentifierPart)(
        char.codePointAt(0) ?? 0,
        FORMULA_TARGET,
      ),
    )
  );
}

/** A key every record in `types` has that shows as text, `label` first. */
export function readableKey(
  checker: ts.TypeChecker,
  types: readonly ts.Type[],
): string | undefined {
  const parts = types.flatMap(unionParts);
  const isRecord = (part: ts.Type) =>
    Boolean(part.flags & ts.TypeFlags.Object) && !checker.isArrayType(part);
  if (parts.length === 0 || !parts.every(isRecord)) return undefined;
  const readableKeys = (part: ts.Type) =>
    checker
      .getPropertiesOfType(part)
      .filter(
        (property) =>
          canFollowDot(property.name) &&
          unrenderablePart(checker.getTypeOfSymbol(property)) === undefined,
      )
      .map((property) => property.name);
  const [first, ...rest] = parts.map(readableKeys);
  const keys = first.filter((key) =>
    rest.every((other) => other.includes(key)),
  );
  return keys.includes("label") ? "label" : keys[0];
}
