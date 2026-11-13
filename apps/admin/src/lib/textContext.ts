const CONTEXT_CHARS = 20;

// The suite launch check stores these excerpts in the dismissal keys of its non-misspelling findings, so changing CONTEXT_CHARS reopens those dismissals.
export const textContext = (span: {
  text: string;
  start: number;
  end: number;
}) => ({
  before: span.text.slice(Math.max(0, span.start - CONTEXT_CHARS), span.start),
  flagged: span.text.slice(span.start, span.end),
  after: span.text.slice(span.end, span.end + CONTEXT_CHARS),
});
