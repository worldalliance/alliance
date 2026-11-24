import { GroupWork, workOfCells } from "./suite-split";

describe("workOfCells", () => {
  it.each([
    [
      [{ assignment: "optional" }, { assignment: "required" }],
      GroupWork.Required,
    ],
    [[{ assignment: "optional" }], GroupWork.OptionalOnly],
    [[], GroupWork.Nothing],
  ] as const)("classifies %j as %s", (cells, work) => {
    expect(workOfCells(cells)).toBe(work);
  });
});
