const nullableNumberFields: ReadonlySet<string> = new Set([
  "suiteId",
  "forumParticipationPostId",
  "timeEstimate",
]);

export const actionFormInputValue = (
  name: string,
  value: string,
): string | number | null => {
  if (!nullableNumberFields.has(name)) return value;
  return value === "" ? null : Number(value);
};
