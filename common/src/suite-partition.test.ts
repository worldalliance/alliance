import { PartWork, workOfCells } from "./suite-partition";

describe("workOfCells", () => {
  it.each([
    [
      [{ assignment: "optional" }, { assignment: "required" }],
      PartWork.Required,
    ],
    [[{ assignment: "optional" }], PartWork.OptionalOnly],
    [[], PartWork.Nothing],
  ] as const)("classifies %j as %s", (cells, work) => {
    expect(workOfCells(cells)).toBe(work);
  });
});
