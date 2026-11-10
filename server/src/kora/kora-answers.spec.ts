import { countAnswers, NO_ANSWER } from "./kora-answers";

describe("countAnswers", () => {
  it("counts each reviewer's profile once, every exit survey, and each value of a list answer", () => {
    const result = countAnswers([
      {
        reviewerId: "r1",
        exported: {
          profile: { is_parent: "yes", children_age_bands: ["7_10", "11_13"] },
          exitSurvey: null,
        },
      },
      {
        reviewerId: "r1",
        exported: {
          profile: { is_parent: "no", children_age_bands: null },
          exitSurvey: { exit_q1: "very" },
        },
      },
      {
        reviewerId: "r2",
        exported: {
          profile: { is_parent: "yes", children_age_bands: null },
          exitSurvey: { exit_q1: "very" },
        },
      },
      {
        reviewerId: "r3",
        exported: { profile: null, exitSurvey: { exit_q1: null } },
      },
    ]);
    expect(result.profiles).toBe(2);
    expect(result.profile).toEqual([
      { question: "is_parent", answers: [{ value: "yes", count: 2 }] },
      {
        question: "children_age_bands",
        answers: [
          { value: "11_13", count: 1 },
          { value: "7_10", count: 1 },
          { value: NO_ANSWER, count: 1 },
        ],
      },
    ]);
    expect(result.exitSurveys).toBe(3);
    expect(result.exitSurvey).toEqual([
      {
        question: "exit_q1",
        answers: [
          { value: "very", count: 2 },
          { value: NO_ANSWER, count: 1 },
        ],
      },
    ]);
  });
});
