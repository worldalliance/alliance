import { TypeKind, type Scope } from "./catalog";
import { parseExpression } from "./parse";
import { scope } from "./syntax-test-support";

describe("scope check", () => {
  test.each([
    "",
    "true",
    "null",
    "this",
    "class",
    "let",
    "static",
    "await",
    "my-name",
    "a /* b */",
    "\\u0061",
  ])(
    "throws for an input called `%s`, which doesn't read back as a name",
    (id) => {
      const unreadable: Scope = {
        ...scope,
        catalog: {
          ...scope.catalog,
          inputs: [{ id, label: id, type: { kind: TypeKind.String } }],
        },
      };
      expect(() => parseExpression("1", unreadable)).toThrow(
        `\`${id}\` doesn't read back as a name.`,
      );
    },
  );

  test.each(["eval", "arguments", "globalThis"])(
    "throws for an input called `%s`, which `tsc` can't declare as a global",
    (id) => {
      const undeclarable: Scope = {
        ...scope,
        catalog: {
          ...scope.catalog,
          inputs: [{ id, label: id, type: { kind: TypeKind.String } }],
        },
      };
      expect(() => parseExpression("1", undeclarable)).toThrow(
        `\`${id}\` can't be declared as a global.`,
      );
    },
  );

  test("throws for an input whose name starts with `__`", () => {
    const internal: Scope = {
      ...scope,
      catalog: {
        ...scope.catalog,
        inputs: [{ id: "__x", label: "x", type: { kind: TypeKind.String } }],
      },
    };
    expect(() => parseExpression("1", internal)).toThrow(
      "`__x` starts with `__`, which the save check keeps for its own names.",
    );
  });

  test.each(["Math", "isUnknown", "undefined", "lookup", "isCalifornia"])(
    "throws for an input called `%s`",
    (id) => {
      const clash: Scope = {
        ...scope,
        catalog: {
          ...scope.catalog,
          inputs: [{ id, label: id, type: { kind: TypeKind.String } }],
        },
      };
      expect(() => parseExpression("1", clash)).toThrow(
        `\`${id}\` names two things in the scope.`,
      );
    },
  );

  test.each([
    [["Math.abs"], "`Math.abs` doesn't read back as a name."],
    [["my-fn"], "`my-fn` doesn't read back as a name."],
    [["isUnknown"], "`isUnknown` names two things in the scope."],
    [["Math"], "`Math` names two things in the scope."],
    [["lookup", "lookup"], "`lookup` names two things in the scope."],
  ])("throws for functions called %j", (names, message) => {
    const clash: Scope = {
      ...scope,
      catalog: {
        ...scope.catalog,
        functions: names.map((name) => ({
          name,
          params: [],
          returns: { kind: TypeKind.Number },
        })),
      },
    };
    expect(() => parseExpression("1", clash)).toThrow(message);
  });

  test.each(["count >", "count;", "1 // note"])(
    "throws for a broken scope whatever the text, such as %j",
    (text) => {
      const unreadable: Scope = {
        ...scope,
        catalog: {
          ...scope.catalog,
          inputs: [
            { id: "true", label: "True", type: { kind: TypeKind.String } },
          ],
        },
      };
      expect(() => parseExpression(text, unreadable)).toThrow(
        "`true` doesn't read back as a name.",
      );
    },
  );

  test("throws for two inputs with one id", () => {
    const input = { id: "count", label: "Count" };
    const clash: Scope = {
      ...scope,
      catalog: {
        ...scope.catalog,
        inputs: [
          { ...input, type: { kind: TypeKind.Number } },
          { ...input, type: { kind: TypeKind.String } },
        ],
      },
    };
    expect(() => parseExpression("count", clash)).toThrow(
      "`count` names two things in the scope.",
    );
  });
});
