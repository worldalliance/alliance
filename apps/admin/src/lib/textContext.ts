const CONTEXT_CHARS = 20;

// The suite launch check stores these excerpts in the dismissal keys of its non-misspelling findings, so changing CONTEXT_CHARS reopens those dismissals.
export const textContext = (span: {
  text: string;
  start: number;
  end: number;
}) => {
  const from = Math.max(0, span.start - CONTEXT_CHARS);
  const to = span.end + CONTEXT_CHARS;
  return {
    before: span.text.slice(from, span.start),
    flagged: span.text.slice(span.start, span.end),
    after: span.text.slice(span.end, to),
    cutBefore: from > 0,
    cutAfter: to < span.text.length,
  };
};
