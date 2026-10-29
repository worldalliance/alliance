export enum TextIssueKind {
  DoubleSpace = "double_space",
  RepeatedWord = "repeated_word",
  SpaceBeforePunctuation = "space_before_punctuation",
  MissingSpaceAfterPunctuation = "missing_space_after_punctuation",
  Misspelling = "misspelling",
  Placeholder = "placeholder",
}

export const TEXT_ISSUE_LABELS: Record<TextIssueKind, string> = {
  [TextIssueKind.DoubleSpace]: "Double space",
  [TextIssueKind.RepeatedWord]: "Repeated word",
  [TextIssueKind.SpaceBeforePunctuation]: "Space before punctuation",
  [TextIssueKind.MissingSpaceAfterPunctuation]:
    "Missing space after punctuation",
  [TextIssueKind.Misspelling]: "Possible misspelling",
  [TextIssueKind.Placeholder]: "Placeholder text",
};

export type TextIssue = {
  kind: TextIssueKind;
  start: number;
  end: number;
};

// Replaced character for character, so issue offsets still index the original text.
const UNCHECKED_SPANS = [
  /(?:https?:\/\/|www\.)\S+/g,
  /\b[\w-]+(?:\.[\w-]+)*\.(?:org|com|net|io|gov|edu|co|us|uk)\b/gi,
  /\]\([^)]*\)/g,
  /```[^\n]*/g,
  /`[^`\n]*`/g,
  /<[^>\n]+>/g,
  /\S+@\S+\.\S+/g,
  /\S+\.(?:webp|png|jpe?g|gif|svg|pdf|mp4)\b/gi,
];
const MASK = "\u0001";

const PATTERNS: [TextIssueKind, RegExp][] = [
  // Markdown reads two trailing spaces as a line break, so only spaces between words count.
  [TextIssueKind.DoubleSpace, /(?<=\S) {2,}(?=\S)/g],
  [TextIssueKind.RepeatedWord, /\b([a-z]+)\s+\1\b/gi],
  [TextIssueKind.SpaceBeforePunctuation, /(?<=\w) +[,.;:!?](?=\s|$)/g],
  [
    TextIssueKind.MissingSpaceAfterPunctuation,
    /(?<=[a-z]{2})[,;.!?](?=[A-Z][a-z])/g,
  ],
  [
    TextIssueKind.Placeholder,
    /\b(?:TODO|TBD|TKTK|FIXME|lorem ipsum)\b|\[(?:insert|add|tbd)\b[^\]]*\]/gi,
  ],
];

// Lowercase only: capitalized words are mostly names the dictionary lacks.
const WORD = /(?<![\w'’\u0001])[a-z]+(?:['’][a-z]+)?(?![\w\u0001])/g;
const MIN_SPELLED_LENGTH = 3;

export function findTextIssues(
  text: string,
  isKnownWord?: (word: string) => boolean,
): TextIssue[] {
  const checked = UNCHECKED_SPANS.reduce(
    (masked, span) =>
      masked.replace(span, (match) => MASK.repeat(match.length)),
    text,
  );
  const issues: TextIssue[] = [];
  for (const [kind, pattern] of PATTERNS) {
    for (const match of checked.matchAll(pattern)) {
      issues.push({
        kind,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  if (isKnownWord) {
    for (const match of checked.matchAll(WORD)) {
      const word = match[0].replace("’", "'").replace(/'s$/, "");
      if (word.length >= MIN_SPELLED_LENGTH && !isKnownWord(word)) {
        issues.push({
          kind: TextIssueKind.Misspelling,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }
  return issues.sort((a, b) => a.start - b.start);
}
