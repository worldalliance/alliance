export type AnswerCount = { value: string; count: number };
export type QuestionCounts = { question: string; answers: AnswerCount[] };

export const NO_ANSWER = "No answer";

const fields = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

function tally(answers: Record<string, unknown>[]): QuestionCounts[] {
  const byQuestion = new Map<string, Map<string, number>>();
  for (const answer of answers) {
    for (const [question, value] of Object.entries(answer)) {
      const counts = byQuestion.get(question) ?? new Map<string, number>();
      byQuestion.set(question, counts);
      const values =
        value === null || value === undefined
          ? [NO_ANSWER]
          : Array.isArray(value)
            ? value.map(String)
            : [String(value)];
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...byQuestion].map(([question, counts]) => ({
    question,
    answers: [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  }));
}

/**
 * Counts each answer to the profile, once per reviewer from the first export
 * that carries it, and to each exit survey.
 */
export function countAnswers(
  exports: { reviewerId: string; exported: unknown }[],
): {
  profiles: number;
  profile: QuestionCounts[];
  exitSurveys: number;
  exitSurvey: QuestionCounts[];
} {
  const profiles = new Map<string, Record<string, unknown>>();
  const exitSurveys: Record<string, unknown>[] = [];
  for (const { reviewerId, exported } of exports) {
    const root = fields(exported);
    const profile = fields(root?.profile);
    if (profile && !profiles.has(reviewerId)) profiles.set(reviewerId, profile);
    const exit = fields(root?.exitSurvey);
    if (exit) exitSurveys.push(exit);
  }
  return {
    profiles: profiles.size,
    profile: tally([...profiles.values()]),
    exitSurveys: exitSurveys.length,
    exitSurvey: tally(exitSurveys),
  };
}
