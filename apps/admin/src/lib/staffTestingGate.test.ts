import { missingForStaffTesting } from "./staffTestingGate";

const ready = {
  shortDescription: "Short",
  body: "Body",
  taskFormId: 3,
  taskKind: "form",
  cohortExpression: { type: "Staff" },
};

describe("missingForStaffTesting", () => {
  it("passes once description, body, task form and cohort are set", () => {
    expect(missingForStaffTesting(ready)).toEqual([]);
  });

  it("lists each missing item, treating whitespace as empty", () => {
    expect(
      missingForStaffTesting({
        shortDescription: "  ",
        body: "",
        taskFormId: undefined,
        cohortExpression: undefined,
      }).map(({ id }) => id),
    ).toEqual(["shortDescription", "body", "taskForm", "cohort"]);
  });
});
