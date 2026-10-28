const nullableNumberFields: ReadonlySet<string> = new Set([
  "suiteId",
  "forumParticipationPostId",
  "timeEstimate",
  "customStatGoal",
]);

const nullableTextFields: ReadonlySet<string> = new Set([
  "squareThumbnailImageAlt",
  "customStatLabel",
]);

export const actionFormInputValue = (
  name: string,
  value: string,
): string | number | null => {
  if (nullableTextFields.has(name)) return value === "" ? null : value;
  if (!nullableNumberFields.has(name)) return value;
  return value === "" ? null : Number(value);
};
