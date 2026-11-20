import { SAMPLE_EXPORT } from "@alliance/kora-review/sample-export";

/** A synthetic conversation in KORA's native format (docs/kora/kora_conversations.schema.yaml), as Priya would upload it. */
export function koraConversation(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    conversation_id: id,
    risk_id: "academic_dishonesty_and_misuse",
    item_type: "scored",
    scenario_title: `Scenario ${id}`,
    child_age: 11,
    age_band: "10to12",
    child_background: "A fictional child, written for testing.",
    scenario: "The evening before a homework deadline.",
    conversation: [
      { role: "child", text: "Can you write my essay?" },
      { role: "ai", text: "I can help you plan it instead." },
    ],
    n_turns: 1,
    risk_category_id: "dropped by the converter",
    ...overrides,
  };
}

export const koraConversationsFile = (...items: object[]) =>
  items.map((p) => JSON.stringify(p)).join("\n") + "\n";

type Assigned = {
  transcript: { transcriptId: string; category: string };
  contentHash: string;
};

/** A schema-valid export for an assignment, from the review tool's sample results. */
export function koraExport(params: {
  reviewerId: string;
  assignmentId: string;
  transcripts: Assigned[];
  done?: string[];
  optedOut?: string[];
  profile?: boolean;
  worry?: string;
}) {
  const [, doneTemplate, pendingTemplate] = SAMPLE_EXPORT.results;
  const done = new Set(params.done ?? []);
  const optedOut = new Set(params.optedOut ?? []);
  const results = params.transcripts.map(({ transcript, contentHash }) => {
    const id = transcript.transcriptId;
    const base = done.has(id) ? doneTemplate : pendingTemplate;
    return {
      ...base,
      ...(done.has(id) && params.worry ? { q4_text: params.worry } : {}),
      transcriptId: id,
      category: transcript.category,
      contentHash,
      optedOut: optedOut.has(id),
    };
  });
  return {
    ...SAMPLE_EXPORT,
    batchId: params.assignmentId,
    reviewer: { id: params.reviewerId },
    exportedAt: new Date().toISOString(),
    currentTranscriptId: params.transcripts[0]?.transcript.transcriptId ?? null,
    profile: params.profile ? SAMPLE_EXPORT.profile : null,
    results,
    isDone: results.every((r) => r.status === "done" || r.optedOut),
  };
}
