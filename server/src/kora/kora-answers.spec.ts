import { countAnswers, NO_ANSWER } from "./kora-answers";

describe("countAnswers", () => {
  it("counts every session's feedback, a skipped question among the answers", () => {
    const result = countAnswers([
      {
        exported: {
          feedback: { f1: "fully", f2: "easy", f7: "The guide helped." },
        },
      },
      { exported: { feedback: { f1: "mostly", f2: "easy", f7: null } } },
      { exported: { feedback: { f1: "fully", f2: null, f7: null } } },
      { exported: { feedback: null } },
    ]);
    expect(result.sessions).toBe(3);
    expect(result.feedback).toEqual([
      {
        question: "f1",
        answers: [
          { value: "fully", count: 2 },
          { value: "mostly", count: 1 },
        ],
      },
      {
        question: "f2",
        answers: [
          { value: "easy", count: 2 },
          { value: NO_ANSWER, count: 1 },
        ],
      },
      {
        question: "f7",
        answers: [
          { value: NO_ANSWER, count: 2 },
          { value: "The guide helped.", count: 1 },
        ],
      },
    ]);
  });

  it("counts each value of a list answer", () => {
    const result = countAnswers([
      { exported: { feedback: { f3: "yes", risks: ["cybersecurity"] } } },
      {
        exported: { feedback: { f3: "no", risks: ["cybersecurity", "bias"] } },
      },
    ]);
    expect(result.feedback[1]).toEqual({
      question: "risks",
      answers: [
        { value: "cybersecurity", count: 2 },
        { value: "bias", count: 1 },
      ],
    });
  });
});
