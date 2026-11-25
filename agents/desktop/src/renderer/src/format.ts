/** A one-line label for a tool call, from the first string with text in its input, such as a file path or command, so it works whatever the CLI names its fields. */
export function toolSummary(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const first = Object.values(input).find(
    (value): value is string =>
      typeof value === "string" && value.trim() !== "",
  );
  return first?.split("\n").find((line) => line.trim() !== "") ?? "";
}

export const folderName = (folder: string): string =>
  folder.split("/").filter(Boolean).at(-1) ?? folder;
