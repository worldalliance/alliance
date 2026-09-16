import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "./no-returned-thenable.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: { allowDefaultProject: ["*.ts"] },
      tsconfigRootDir: import.meta.dirname,
    },
  },
});

const prelude = `
declare function it(name: string, fn: () => unknown): void;
declare namespace it {
  function each(cases: unknown[]): (name: string, fn: () => unknown) => void;
  function skip(name: string, fn: () => unknown): void;
}
declare function beforeEach(fn: () => unknown): void;
declare function describe(name: string, fn: () => unknown): void;
declare class Req { then(resolve: (value: number) => void): void; }
declare function request(): Req;
declare function run(fn: () => unknown): void;
`;

const errors = [{ messageId: "returnedThenable" as const }];

ruleTester.run("no-returned-thenable", rule, {
  valid: [
    `it("awaits", async () => { await request(); });`,
    `it("returns from an async callback", async () => request());`,
    `it("returns a Promise", () => Promise.resolve(1));`,
    `it("nested function", () => { const f = () => { return request(); }; void f; });`,
    `describe("not a test callback", () => request());`,
    `run(() => request());`,
  ].map((code) => prelude + code),
  invalid: [
    `it("expression body", () => request());`,
    `it("block return", () => { return request(); });`,
    `it("function expression", function () { return request(); });`,
    `it("union with Promise", () => (Math.random() ? request() : Promise.resolve(1)));`,
    `it.each([1])("each", () => request());`,
    `it.skip("skip", () => request());`,
    `beforeEach(() => request());`,
  ].map((code) => ({ code: prelude + code, errors })),
});
