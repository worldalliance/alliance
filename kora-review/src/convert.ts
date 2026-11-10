// Reads KORA's pair export (pair_id, risk_id, conversation_a/b with child and ai turns) and converts each
// pair into a transcript line for transcriptSchema. Fields the schema doesn't name (model names,
// comprehension_options, feedback_text, note, risk_category_id, ...) are dropped. The converter checks
// nothing: validate its output against transcriptSchema.

export type KoraPairRecord =
  | { line: number; ok: true; record: unknown }
  | { line: number; ok: false; error: string };

/** Splits KORA's file into records numbered from 1: JSON Lines, or a JSON array (one element per number). */
export function readKoraPairs(text: string): KoraPairRecord[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((record, i) => ({ line: i + 1, ok: true, record }));
      }
    } catch {
      // An array split one element per line isn't valid JSON as a whole; read it line by line.
    }
  }
  return text.split("\n").flatMap((raw, i): KoraPairRecord[] => {
    const line = raw
      .trim()
      .replace(/^\[|\]$/g, "")
      .replace(/,\s*$/, "");
    if (!line) return [];
    try {
      return [{ line: i + 1, ok: true, record: JSON.parse(line) }];
    } catch (e) {
      return [
        {
          line: i + 1,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        },
      ];
    }
  });
}

const fields = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

const turns = (list: unknown) =>
  (Array.isArray(list) ? list : []).map((turn: unknown) => {
    const m = fields(turn);
    return {
      role: m.role === "ai" ? "ai" : "child",
      text: String(m.text ?? ""),
    };
  });

/** Maps one KORA pair onto transcriptSchema's field names. */
export function fromKoraPair(record: unknown): Record<string, unknown> {
  const p = fields(record);
  return {
    transcriptId: String(p.pair_id),
    category: p.risk_id,
    ...(p.pair_type ? { pairType: String(p.pair_type) } : {}),
    scenarioTitle: String(p.scenario_title ?? p.pair_id),
    childAge: Number(p.child_age),
    ...(p.age_band ? { ageBand: String(p.age_band) } : {}),
    ...(p.child_background
      ? { childBackground: String(p.child_background) }
      : {}),
    ...(p.scenario ? { scenario: String(p.scenario) } : {}),
    conversationA: turns(p.conversation_a),
    conversationB: turns(p.conversation_b),
  };
}
