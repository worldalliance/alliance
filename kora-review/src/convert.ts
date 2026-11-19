import { isNode, isSeq, LineCounter, parseDocument } from "yaml";

// Reads KORA's import file, whatever shape it arrives in, and converts each record onto the field names
// the host stores: conversations for conversationSchema (v6), pairs for transcriptSchema (v5.2, on its way
// out). Fields the schemas don't name (model names, feedback_text, note, risk_category_id, ...) are
// dropped. The converters check nothing and pass required values through unchanged, so validating their
// output catches a missing or malformed one.

export type KoraFileRecord =
  | { line: number; ok: true; record: unknown }
  | { line: number; ok: false; error: string };

function readYaml(text: string): KoraFileRecord[] {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter });
  if (doc.errors.length > 0) {
    return doc.errors.map((e) => ({
      line: e.linePos?.[0].line ?? 1,
      ok: false,
      error: e.message,
    }));
  }
  if (doc.contents === null) return [];
  if (!isSeq(doc.contents)) {
    return [{ line: 1, ok: false, error: "a YAML file must be a list" }];
  }
  return doc.contents.items.map((item) => ({
    line:
      isNode(item) && item.range ? lineCounter.linePos(item.range[0]).line : 1,
    ok: true,
    record: isNode(item) ? item.toJS(doc) : item,
  }));
}

/**
 * Splits KORA's file into records: JSON Lines numbered by line, a JSON array numbered by element, or a YAML
 * list numbered by the line each record starts on. The first character that isn't whitespace or a YAML
 * comment picks the format.
 */
export function readKoraRecords(text: string): KoraFileRecord[] {
  const trimmed = text.trim();
  const first = trimmed.replace(/^(#.*(\n|$)|\s+)*/, "")[0];
  if (first !== "[" && first !== "{") return first ? readYaml(text) : [];
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
  return text.split("\n").flatMap((raw, i): KoraFileRecord[] => {
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
    return { role: m.role, text: m.text };
  });

/** Maps one KORA pair onto transcriptSchema's field names. */
export function fromKoraPair(record: unknown): Record<string, unknown> {
  const p = fields(record);
  return {
    transcriptId: p.pair_id,
    category: p.risk_id,
    ...(p.pair_type ? { pairType: String(p.pair_type) } : {}),
    scenarioTitle: p.scenario_title,
    childAge: p.child_age,
    ...(p.age_band ? { ageBand: String(p.age_band) } : {}),
    ...(p.child_background
      ? { childBackground: String(p.child_background) }
      : {}),
    ...(p.scenario ? { scenario: String(p.scenario) } : {}),
    conversationA: turns(p.conversation_a),
    conversationB: turns(p.conversation_b),
  };
}

/** Maps one conversation from KORA's import file (Annex B) onto conversationSchema's field names. */
export function fromKoraConversation(record: unknown): Record<string, unknown> {
  const c = fields(record);
  return {
    conversationId: c.conversation_id,
    itemType: c.item_type,
    riskId: c.risk_id,
    scenarioTitle: c.scenario_title,
    childAge: c.child_age,
    nTurns: c.n_turns,
    conversation: turns(c.conversation),
    ...(c.age_band ? { ageBand: String(c.age_band) } : {}),
    ...(c.child_gender !== undefined ? { childGender: c.child_gender } : {}),
    ...(c.child_background
      ? { childBackground: String(c.child_background) }
      : {}),
    ...(c.scenario ? { scenario: String(c.scenario) } : {}),
    ...(typeof c.opt_in === "boolean" ? { optIn: c.opt_in } : {}),
    ...(c.comprehension_options !== undefined
      ? { comprehensionOptions: c.comprehension_options }
      : {}),
    ...(c.comprehension_correct !== undefined
      ? { comprehensionCorrect: c.comprehension_correct }
      : {}),
    ...(c.reference_verdict !== undefined
      ? { referenceVerdict: c.reference_verdict }
      : {}),
    ...(c.reference_reason !== undefined
      ? { referenceReason: c.reference_reason }
      : {}),
  };
}
