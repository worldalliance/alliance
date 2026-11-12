const summaryLength = 80;

/** The first non-empty string in a tool call's input, such as a file path or command, which identifies the call whatever the CLI names its fields. */
export function toolSummary(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const first = Object.values(input).find(
    (value): value is string => typeof value === "string" && value !== "",
  );
  const line = first?.split("\n")[0] ?? "";
  return line.length > summaryLength
    ? `${line.slice(0, summaryLength - 1)}…`
    : line;
}

export const folderName = (folder: string): string =>
  folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder;
