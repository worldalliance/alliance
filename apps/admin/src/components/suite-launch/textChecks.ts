export enum TextIssueKind {
  DoubleSpace = "double_space",
  RepeatedWord = "repeated_word",
  SpaceBeforePunctuation = "space_before_punctuation",
  MissingSpaceAfterPunctuation = "missing_space_after_punctuation",
  Misspelling = "misspelling",
  Placeholder = "placeholder",
  UnreachableLink = "unreachable_link",
}

export const TEXT_ISSUE_LABELS: Record<TextIssueKind, string> = {
  [TextIssueKind.DoubleSpace]: "Double space",
  [TextIssueKind.RepeatedWord]: "Repeated word",
  [TextIssueKind.SpaceBeforePunctuation]: "Space before punctuation",
  [TextIssueKind.MissingSpaceAfterPunctuation]:
    "Missing space after punctuation",
  [TextIssueKind.Misspelling]: "Possible misspelling",
  [TextIssueKind.Placeholder]: "Placeholder text",
  [TextIssueKind.UnreachableLink]: "Link members can't open",
};

type RuleKind = Exclude<TextIssueKind, TextIssueKind.Misspelling>;

export type TextIssue = { start: number; end: number } & (
  | { kind: RuleKind }
  | {
      kind: TextIssueKind.Misspelling;
      /** The word looked up: straight apostrophes, no trailing `'s`. */
      word: string;
    }
);

// Replaced character for character, so issue offsets still index the original text.
const UNCHECKED_SPANS = [
  /\]\([^)]*\)/g,
  /(?:https?:\/\/|www\.)\S+/g,
  /\S+@\S+\.\S+/g,
  // Case-sensitive, so a sentence ending before "Net" or "Us" with no space still counts.
  /\b[\w-]+(?:\.[\w-]+)*\.(?:org|com|net|io|gov|edu|co|us|uk)\b(?:\/\S*)?/g,
  /^ {0,3}```[^`\n]*$/gm,
  /`[^`\n]*`/g,
  /<[^>\n]+>/g,
  /\S+\.(?:webp|png|jpe?g|gif|svg|pdf|mp4)\b/gi,
];
const MASK = "\u0001";

const PATTERNS: [RuleKind, RegExp][] = [
  // Markdown reads two trailing spaces as a line break, so only spaces between words count.
  [TextIssueKind.DoubleSpace, /(?<=\S) {2,}(?=\S)/g],
  [TextIssueKind.RepeatedWord, /\b([a-z]+)\s+\1\b/gi],
  [TextIssueKind.SpaceBeforePunctuation, /(?<=\w) +[,.;:!?](?=\s|$)/g],
  [
    TextIssueKind.MissingSpaceAfterPunctuation,
    /(?<=[a-z]{2})[,;.!?](?=[A-Z][a-z])/g,
  ],
  [TextIssueKind.Placeholder, /\b(?:TODO|TBD|TKTK|FIXME)\b/g],
  [
    TextIssueKind.Placeholder,
    /\blorem ipsum\b|\[(?:insert|add|tbd)\b[^\]\u0001]*\]/gi,
  ],
];

// Staff, test, and placeholder hosts, matched in the unmasked text since links are masked.
const UNREACHABLE_LINK =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|(?:[\w-]+\.)*example\.(?:com|org|net)|(?:admin|staging)\.[\w-]+(?:\.[\w-]+)+)(?![\w-]|\.[\w-])(?::\d+)?(?:\/[^\s)\]>"']*)?(?<![.,;:!?])/gi;

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
  for (const match of text.matchAll(UNREACHABLE_LINK)) {
    issues.push({
      kind: TextIssueKind.UnreachableLink,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  if (isKnownWord) {
    for (const match of checked.matchAll(WORD)) {
      const word = match[0].replace("’", "'").replace(/'s$/, "");
      if (word.length >= MIN_SPELLED_LENGTH && !isKnownWord(word)) {
        issues.push({
          kind: TextIssueKind.Misspelling,
          start: match.index,
          end: match.index + match[0].length,
          word,
        });
      }
    }
  }
  return issues.sort((a, b) => a.start - b.start);
}
