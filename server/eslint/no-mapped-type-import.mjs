/**
 * @fileoverview Disallow importing PickType from @nestjs/mapped-types
 */

export default {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow importing PickType from @nestjs/mapped-types',
        category: 'Best Practices',
        recommended: false,
      },
      schema: [], // no options
    },
  
    create(context) {
      return {
        ImportDeclaration(node) {
          if (node.source.value === '@nestjs/mapped-types') {
            node.specifiers.forEach((spec) => {
              if (
                (spec.imported && spec.imported.name === 'PickType') ||
                (spec.local && spec.local.name === 'PickType')
              ) {
                context.report({
                  node: spec,
                  message:
                    "Importing 'PickType' from '@nestjs/mapped-types' is forbidden.",
                });
              }
            });
          }
        },
      };
    },
  };
  