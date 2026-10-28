import { actionFormInputValue } from "./actionFormInputValue";

describe("actionFormInputValue", () => {
  it.each([
    "suiteId",
    "forumParticipationPostId",
    "timeEstimate",
    "customStatGoal",
  ])("clears a blank %s to null and keeps a typed number as is", (name) => {
    expect(actionFormInputValue(name, "")).toBeNull();
    expect(actionFormInputValue(name, "42")).toBe(42);
    expect(actionFormInputValue(name, "4.2")).toBe(4.2);
  });

  it.each(["squareThumbnailImageAlt", "customStatLabel"])(
    "clears a blank %s to null and keeps typed text as is",
    (name) => {
      expect(actionFormInputValue(name, "")).toBeNull();
      expect(actionFormInputValue(name, "42")).toBe("42");
    },
  );

  it("keeps other fields as typed", () => {
    expect(actionFormInputValue("name", "")).toBe("");
    expect(actionFormInputValue("name", "42")).toBe("42");
  });
});
