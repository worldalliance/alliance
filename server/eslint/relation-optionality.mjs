/**
 * @fileoverview Enforce the entity shape convention on relation properties:
 * a relation is `?: Relation<...>`.
 *
 * `undefined` on an entity means "not loaded", so a relation must be optional
 * to be able to say that, and a field that is optional for any other reason is
 * indistinguishable from one that wasn't loaded. `EntityShapeViolations`
 * enforces the same rule at the type level, but only once an entity is consumed
 * through `Repository` — this rule reports it against the entity itself.
 */

import {
  findBrand,
  findRelationDecorator,
  propertyName,
} from './relation-ast.mjs';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require entity relations to be optional and branded',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          checkLazyOptional: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      lazyMustBeOptional:
        '`{{name}}` is a relation, so it must be declared `{{name}}?:` — `undefined` is how a find result says it was not loaded.',
      missingBrand:
        '`{{name}}` is a relation, so its type must be `Relation<...>` for the find signatures to track whether it was loaded.',
    },
  },

  create(context) {
    const { checkLazyOptional = true } = context.options[0] ?? {};

    return {
      PropertyDefinition(node) {
        if (!findRelationDecorator(node)) return;

        const name = propertyName(node);

        if (!findBrand(node.typeAnnotation?.typeAnnotation)) {
          context.report({
            node: node.key,
            messageId: 'missingBrand',
            data: { name },
          });
          return;
        }

        if (checkLazyOptional && !node.optional) {
          context.report({
            node: node.key,
            messageId: 'lazyMustBeOptional',
            data: { name },
            // `foo!: T` would become `foo?!: T`; leave those to be fixed by hand.
            fix: node.definite
              ? undefined
              : (fixer) => fixer.insertTextAfter(node.key, '?'),
          });
        }
      },
    };
  },
};

export default rule;
