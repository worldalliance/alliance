/**
 * @fileoverview Enforce the entity shape convention on non-relation properties:
 * a column's TS type is the DB constraint, restated.
 *
 * `undefined` on an entity means "not loaded", and a column is always loaded, so
 * a column property can never be optional. Absence is spelled `null`, and only
 * when the column is actually `nullable: true`. Sibling of
 * `relation-optionality`, which enforces the opposite rule on the relation half.
 */

import {
  decoratorName,
  findRelationDecorator,
  propertyName,
} from "./relation-ast.mjs";

const COLUMN_DECORATORS = new Set([
  "Column",
  "CreateDateColumn",
  "CreateDateColumnTz",
  "DeleteDateColumn",
  "ObjectIdColumn",
  "PrimaryColumn",
  "PrimaryGeneratedColumn",
  "UpdateDateColumn",
  "UpdateDateColumnTz",
  "VersionColumn",
  "ViewColumn",
]);

/** TypeORM makes the soft-delete timestamp nullable regardless of options. */
const IMPLICITLY_NULLABLE = new Set(["DeleteDateColumn"]);

/** Union members of these need parenthesising before `| null` can be appended. */
const NEEDS_PARENS = new Set([
  "TSConditionalType",
  "TSConstructorType",
  "TSFunctionType",
]);

function findColumnDecorator(node) {
  return (
    node.decorators?.find((d) => {
      const name = decoratorName(d);
      return name === "RelationId" || COLUMN_DECORATORS.has(name);
    }) ?? null
  );
}

function staticKey(property) {
  if (property.computed) return null;
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return String(property.key.value);
  return null;
}

/**
 * Whether the decorated column is nullable in Postgres, or `null` when the
 * decorator can't be read statically (a spread, a computed key, a `nullable`
 * that isn't a boolean literal).
 */
function columnNullable(decorator, name) {
  if (IMPLICITLY_NULLABLE.has(name)) return true;

  const options = decorator.expression.arguments.find(
    (arg) => arg.type === "ObjectExpression",
  );
  if (!options) return false;

  let nullable = false;
  for (const property of options.properties) {
    if (property.type !== "Property") return null;
    const key = staticKey(property);
    if (key === null) return null;
    if (key !== "nullable") continue;
    if (
      property.value.type !== "Literal" ||
      typeof property.value.value !== "boolean"
    ) {
      return null;
    }
    nullable = property.value.value;
  }
  return nullable;
}

function unionMembers(typeNode) {
  if (!typeNode) return [];
  return typeNode.type === "TSUnionType" ? typeNode.types : [typeNode];
}

function includesKeyword(typeNode, keyword) {
  return unionMembers(typeNode).some((member) => member.type === keyword);
}

function appendNull(fixer, typeNode) {
  return NEEDS_PARENS.has(typeNode.type)
    ? [
        fixer.insertTextBefore(typeNode, "("),
        fixer.insertTextAfter(typeNode, ") | null"),
      ]
    : [fixer.insertTextAfter(typeNode, " | null")];
}

/**
 * Drop the `?` and restate the column's nullability, or `undefined` when the
 * property needs hand work: `nullable` is unknown for a `@RelationId`, and an
 * explicit `| undefined` needs the union rewritten rather than appended to.
 */
function dropOptionalFix(sourceCode, node, typeNode, nullable) {
  if (
    node.definite ||
    !node.optional ||
    !typeNode ||
    nullable === null ||
    includesKeyword(typeNode, "TSUndefinedKeyword")
  ) {
    return undefined;
  }

  const question = sourceCode.getTokenAfter(node.key);
  if (question?.value !== "?") return undefined;

  return (fixer) => [
    fixer.remove(question),
    ...(nullable && !includesKeyword(typeNode, "TSNullKeyword")
      ? appendNull(fixer, typeNode)
      : []),
  ];
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require entity columns to be non-optional and to restate the column's nullability",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          checkOptional: { type: "boolean" },
          checkMissingNull: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      columnMustNotBeOptional:
        "`{{name}}` is a column, so it is always loaded and must be declared `{{name}}:` — spell absence as `| null`, and only if the column is nullable.",
      nullableColumnNeedsNull:
        "`{{name}}` is a `nullable: true` column, so its type must include `null`.",
      nonNullableColumnHasNull:
        "`{{name}}` is a `NOT NULL` column, so its type must not include `null`.",
    },
  },

  create(context) {
    const { checkOptional = true, checkMissingNull = true } =
      context.options[0] ?? {};
    const { sourceCode } = context;

    return {
      PropertyDefinition(node) {
        if (findRelationDecorator(node)) return;

        const decorator = findColumnDecorator(node);
        if (!decorator) return;

        const name = propertyName(node);
        const typeNode = node.typeAnnotation?.typeAnnotation;
        const kind = decoratorName(decorator);
        // A `@RelationId` mirrors an FK column, whose nullability lives on the
        // relation rather than on this decorator, so only optionality is
        // decidable here.
        const nullable =
          kind === "RelationId" ? null : columnNullable(decorator, kind);

        if (node.optional || includesKeyword(typeNode, "TSUndefinedKeyword")) {
          if (checkOptional) {
            context.report({
              node: node.key,
              messageId: "columnMustNotBeOptional",
              data: { name },
              fix: dropOptionalFix(sourceCode, node, typeNode, nullable),
            });
          }
          // The null checks only make sense once the `?` is gone; re-running
          // the rule after the fix picks them up.
          return;
        }

        if (nullable === null || !typeNode) return;

        const hasNull = includesKeyword(typeNode, "TSNullKeyword");

        if (nullable && !hasNull && checkMissingNull) {
          context.report({
            node: node.key,
            messageId: "nullableColumnNeedsNull",
            data: { name },
            fix: (fixer) => appendNull(fixer, typeNode),
          });
        } else if (!nullable && hasNull) {
          // Unfixable on purpose: dropping `| null` is only correct if every
          // reader already handles the value, which the rule can't know.
          context.report({
            node: node.key,
            messageId: "nonNullableColumnHasNull",
            data: { name },
          });
        }
      },
    };
  },
};

export default rule;
