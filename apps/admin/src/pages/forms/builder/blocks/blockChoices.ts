/** The option of `choices` that `value` names, for a native select's change. */
export function choiceOf<T extends string | number>(
  choices: readonly { value: T }[],
  value: string,
): T | undefined {
  return choices.find((choice) => String(choice.value) === value)?.value;
}
