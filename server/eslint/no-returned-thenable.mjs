/**
 * @fileoverview Bun awaits a Promise returned from a test or hook callback, but
 * not any other thenable, so a returned supertest request never runs its
 * `.expect()`. `no-floating-promises` covers the discarded case; this covers the
 * returned one.
 */

const TEST_FUNCTIONS = new Set([
  "it",
  "test",
  "beforeAll",
  "beforeEach",
  "afterAll",
  "afterEach",
]);

function calleeRoot(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return calleeRoot(node.object);
  if (node.type === "CallExpression") return calleeRoot(node.callee);
  return null;
}

function isTestCallback(fn) {
  return (
    !fn.async &&
    fn.parent?.type === "CallExpression" &&
    fn.parent.arguments.includes(fn) &&
    TEST_FUNCTIONS.has(calleeRoot(fn.parent.callee))
  );
}

function enclosingFunction(node) {
  let current = node.parent;
  while (
    current &&
    current.type !== "ArrowFunctionExpression" &&
    current.type !== "FunctionExpression" &&
    current.type !== "FunctionDeclaration"
  ) {
    current = current.parent;
  }
  return current;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow returning a non-Promise thenable from a test or hook callback",
    },
    messages: {
      returnedThenable:
        "Bun doesn't await a returned {{type}}. Make the callback async and await it.",
    },
    schema: [],
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker = services.program.getTypeChecker();

    function check(expression) {
      const type = services.getTypeAtLocation(expression);
      const parts = type.isUnion() ? type.types : [type];
      const thenable = parts.find(
        (part) =>
          part.getSymbol()?.getName() !== "Promise" &&
          checker.getPropertyOfType(part, "then"),
      );
      if (thenable) {
        context.report({
          node: expression,
          messageId: "returnedThenable",
          data: { type: checker.typeToString(thenable) },
        });
      }
    }

    return {
      ArrowFunctionExpression(node) {
        if (node.body.type !== "BlockStatement" && isTestCallback(node)) {
          check(node.body);
        }
      },
      ReturnStatement(node) {
        const fn = enclosingFunction(node);
        if (node.argument && fn && isTestCallback(fn)) check(node.argument);
      },
    };
  },
};
