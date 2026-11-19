import { KoraItemType, koraWeightUnits } from "@alliance/common/kora";
import type { KoraItem } from "@alliance/kora-review";
import { CATEGORIES } from "@alliance/kora-review/categories";
import {
  type KoraStoredConversation,
  parseKoraConversation,
} from "@alliance/kora-review/parse";
import type { KoraConversation } from "./entities/kora-conversation.entity";
import type { KoraSessionConversation } from "./entities/kora-session-conversation.entity";

const RISKS = new Map(CATEGORIES.map((risk) => [String(risk.id), risk]));

/**
 * KORA delivers one guide per risk with the full set; until then the reviewer gets the risk's own
 * line, which is what the opt-out screen shows, and is told the rest is coming.
 */
function guideFor(riskId: string): string {
  const risk = RISKS.get(riskId);
  if (!risk) return "";
  return [
    `**${risk.label}.** ${risk.description ?? ""}`.trim(),
    "KORA's full one-page guide for this risk arrives with the review set.",
  ].join("\n\n");
}

/** What the reviewer is shown. Everything the host keeps to itself is left out here, not hidden later. */
export function koraItem(params: {
  conversation: KoraConversation;
  ratedPosition: number | null;
  firstTimeOnRisk: boolean;
}): KoraItem {
  const stored = parseKoraConversation(params.conversation.content);
  const risk = RISKS.get(stored.riskId);
  const practice = stored.itemType === KoraItemType.Practice;
  return {
    conversationId: stored.conversationId,
    riskId: stored.riskId,
    riskName: risk ? risk.label : stored.riskId,
    guide: guideFor(stored.riskId),
    hard: risk ? risk.sensitive : true,
    firstTimeOnRisk: params.firstTimeOnRisk,
    childAge: stored.childAge,
    childGender: stored.childGender ?? null,
    childBackground: stored.childBackground,
    scenario: stored.scenario,
    scenarioTitle: stored.scenarioTitle,
    conversation: stored.conversation,
    comprehension: stored.comprehensionOptions
      ? { options: stored.comprehensionOptions }
      : null,
    kind: practice ? "practice" : "rated",
    reference:
      practice && stored.referenceVerdict && stored.referenceReason
        ? { verdict: stored.referenceVerdict, reason: stored.referenceReason }
        : null,
    position: params.ratedPosition,
    weightUnits: practice ? 0 : koraWeightUnits(stored.nTurns),
    contentHash: params.conversation.contentHash,
  };
}

/** The attention conversation passes when the verdict matches the import's reference (spec 6.0 section 8). */
export function attentionPass(params: {
  stored: KoraStoredConversation;
  verdict: unknown;
}): boolean | null {
  if (params.stored.itemType !== KoraItemType.Attention) return null;
  if (!params.stored.referenceVerdict) return null;
  return params.verdict === params.stored.referenceVerdict;
}

export const storedConversation = (
  row: KoraSessionConversation,
): KoraStoredConversation => {
  if (!row.conversation)
    throw new Error(`Session row ${row.conversationId} has no conversation.`);
  return parseKoraConversation(row.conversation.content);
};
