/**
 * @fileoverview Shared AST helpers for the entity-relation lint rules.
 */

const RELATION_DECORATORS = new Set([
  'OneToOne',
  'OneToMany',
  'ManyToOne',
  'ManyToMany',
]);

/** Type references that wrap a relation rather than being one. */
const TRANSPARENT_WRAPPERS = new Set(['Promise', 'Array', 'Readonly']);

function decoratorName(decorator) {
  const { expression } = decorator;
  if (expression.type !== 'CallExpression') return null;
  return expression.callee.type === 'Identifier'
    ? expression.callee.name
    : null;
}

export function findRelationDecorator(node) {
  return (
    node.decorators?.find((d) => RELATION_DECORATORS.has(decoratorName(d))) ??
    null
  );
}

/**
 * The `Relation` reference in a property's type annotation, looking through the
 * array, union and promise wrappers that `IsRelation` also looks through.
 * Returns `null` for an unbranded type.
 */
export function findBrand(typeNode) {
  if (!typeNode) return null;

  switch (typeNode.type) {
    case 'TSArrayType':
      return findBrand(typeNode.elementType);
    case 'TSUnionType':
    case 'TSIntersectionType':
      for (const member of typeNode.types) {
        const found = findBrand(member);
        if (found) return found;
      }
      return null;
    case 'TSTypeReference': {
      if (typeNode.typeName.type !== 'Identifier') return null;
      const { name } = typeNode.typeName;
      if (name === 'Relation') return typeNode;
      if (TRANSPARENT_WRAPPERS.has(name)) {
        const [first] = typeNode.typeArguments?.params ?? [];
        return findBrand(first);
      }
      return null;
    }
    default:
      return null;
  }
}

export function propertyName(node) {
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal') return String(node.key.value);
  return 'relation';
}
