import { World } from "./check-world";

test("a rewritten file is listed once among the root files", () => {
  const world = new World({ inputs: [], functions: [], lists: [] });
  world.write("/a.ts", 'const a: number = "x";');
  expect(world.diagnostics("/a.ts")).toHaveLength(1);
  world.write("/a.ts", "const a: number = 1;");
  expect(world.diagnostics("/a.ts")).toEqual([]);
  expect(
    world
      .program()
      .getRootFileNames()
      .filter((name) => name === "/a.ts"),
  ).toEqual(["/a.ts"]);
});
