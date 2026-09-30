import { pickForCount, withCount } from "@alliance/common/plural";
import type { Assert, Equal } from "@alliance/common/types";
import {
  WaitlistEmailPlaceholder,
  waitlistEmailToken,
  withoutOrganizationMessage,
} from "@alliance/common/waitlistEmail";
import type {
  WaitlistEmailBatchDto,
  WaitlistEmailPreviewDto,
  WaitlistEmailRecipientStatus,
} from "@alliance/shared/client/types.gen";
import { milliseconds } from "date-fns";

export type EmailDraft = { subject: string; body: string };

const have = (count: number) => pickForCount(count, "has", "have");

/** Why the email can't go to these recipients as written, if it can't. */
export function blockingProblem(params: {
  preview: WaitlistEmailPreviewDto;
  used: ReadonlySet<WaitlistEmailPlaceholder>;
}): string | null {
  const { preview, used } = params;
  if (!preview.recipientIds.length) {
    return "Every selected entry is skipped, so nobody would get this email.";
  }
  if (
    used.has(WaitlistEmailPlaceholder.OrganizationName) &&
    preview.withoutOrganization
  ) {
    return `${withoutOrganizationMessage(preview.withoutOrganization)}. Change the text or the selection.`;
  }
  return null;
}

/** Things staff should know before sending, none of which stop it. */
export function emailWarnings(params: {
  preview: WaitlistEmailPreviewDto;
  used: ReadonlySet<WaitlistEmailPlaceholder>;
  includeClaimed: boolean;
}): string[] {
  const { preview, used, includeClaimed } = params;
  const signupLink = used.has(WaitlistEmailPlaceholder.SignupLink);
  const warnings: string[] = [];
  if (
    preview.withoutOrganization &&
    !used.has(WaitlistEmailPlaceholder.OrganizationName)
  ) {
    warnings.push(
      `${withCount(preview.withoutOrganization, "recipient")} ${have(preview.withoutOrganization)} no organization, so staff place them after they sign up.`,
    );
  }
  if (preview.withoutGroup) {
    warnings.push(
      `${withCount(preview.withoutGroup, "recipient")} ${have(preview.withoutGroup)} an organization without a group, so staff place them after they sign up.`,
    );
  }
  if (preview.inFullGroup) {
    warnings.push(
      `${withCount(preview.inFullGroup, "recipient")} ${have(preview.inFullGroup)} an organization whose group is full, so staff may need to place them after they sign up.`,
    );
  }
  if (preview.alreadySent) {
    warnings.push(
      `${withCount(preview.alreadySent, "recipient")} already got, or ${pickForCount(preview.alreadySent, "is", "are")} getting, an email with this subject.`,
    );
  }
  if (includeClaimed && preview.claimed) {
    warnings.push(
      signupLink
        ? `${withCount(preview.claimed, "recipient")} already claimed an invite and get a new one.`
        : `${withCount(preview.claimed, "recipient")} already claimed an invite.`,
    );
  }
  return warnings;
}

export function skippedGroups(params: {
  preview: WaitlistEmailPreviewDto;
  includeClaimed: boolean;
}): string[] {
  const { preview, includeClaimed } = params;
  return [
    preview.unsubscribed ? `${preview.unsubscribed} unsubscribed` : null,
    !includeClaimed && preview.claimed
      ? `${preview.claimed} who already claimed an invite`
      : null,
  ].filter((group) => group !== null);
}

export function sendConfirmation(params: {
  preview: WaitlistEmailPreviewDto;
  used: ReadonlySet<WaitlistEmailPlaceholder>;
  includeClaimed: boolean;
  subject: string;
  mobilize: boolean;
}): string {
  const { preview, used, includeClaimed, subject, mobilize } = params;
  const recipients = preview.recipientIds.length;
  const skipped = skippedGroups({ preview, includeClaimed });
  const lines = [
    `Email “${subject}” to ${withCount(recipients, "recipient")} now.`,
    skipped.length ? `Skips ${skipped.join(" and ")}.` : null,
    !mobilize
      ? "Mobilized status stays as it is."
      : preview.waiting
        ? `Marks the ${preview.waiting} waiting as mobilized as each email is accepted. Anyone already mobilized keeps their date.`
        : "Everyone is already mobilized and keeps their date.",
    mobilize && !used.has(WaitlistEmailPlaceholder.SignupLink)
      ? `This email has no ${waitlistEmailToken(WaitlistEmailPlaceholder.SignupLink)}, so it accepts people without inviting them in it.`
      : null,
    used.has(WaitlistEmailPlaceholder.SignupLink)
      ? "Recipients without an unused invite get a new one."
      : null,
    ...emailWarnings({ preview, used, includeClaimed }),
  ];
  return lines.filter((line) => line !== null).join("\n\n");
}

export const STATUS_LABELS: Record<WaitlistEmailRecipientStatus, string> = {
  pending: "Pending",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  uncertain: "Uncertain",
  skipped: "Skipped",
};

export const STATUSES = [
  "sent",
  "pending",
  "sending",
  "failed",
  "uncertain",
  "skipped",
] as const satisfies readonly WaitlistEmailRecipientStatus[];

type _typecheck = Assert<
  Equal<(typeof STATUSES)[number], WaitlistEmailRecipientStatus>
>;

export const inProgress = (batch: WaitlistEmailBatchDto): boolean =>
  batch.counts.pending + batch.counts.sending > 0;

export const SENDING_POLL_MS = milliseconds({ seconds: 3 });
