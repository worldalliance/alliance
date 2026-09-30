import { R } from "@alliance/common/result";
import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
} from "@alliance/common/waitlistEmail";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MailService } from "src/mail/mail.service";
import {
  signupUrl,
  waitlistUnsubscribeLink,
  withRef,
} from "src/search/approutes";
import type { Repository } from "src/utils/Repository";
import type {
  PreviewWaitlistEmailDto,
  WaitlistEmailPreview,
  WaitlistEmailSample,
} from "./dto/waitlist-email.dto";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import {
  skipReason,
  type WaitlistEmailCandidate,
  WaitlistEmailSkipReason,
  waitlistEmailValues,
} from "./waitlist-email-audience";
import { renderWaitlistEmail } from "./waitlist-email-render";
import { ENTRY_INVITE_CLAIMED_SQL } from "./waitlist-entry-admin.service";

// A preview never issues an invite or carries a real entry's unsubscribe link.
const SAMPLE_SIGNUP_CODE = "SIGNUP-CODE";
const SAMPLE_UNSUBSCRIBE_TOKEN = "00000000-0000-0000-0000-000000000000";

@Injectable()
export class WaitlistEmailService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly entryRepository: Repository<WaitlistEntry>,
    private readonly mailService: MailService,
  ) {}

  private async findCandidates(
    entryIds: number[],
  ): Promise<WaitlistEmailCandidate[]> {
    const selected = () =>
      this.entryRepository
        .createQueryBuilder("entry")
        .where("entry.id = ANY(:entryIds)", { entryIds });
    const [entries, claimedRows] = await Promise.all([
      selected()
        .leftJoinAndSelect("entry.organization", "organization")
        .orderBy("entry.id")
        .getMany(),
      selected()
        .select("entry.id", "id")
        .andWhere(ENTRY_INVITE_CLAIMED_SQL)
        .getRawMany<{ id: number }>(),
    ]);
    const claimed = new Set(claimedRows.map((row) => row.id));
    return entries.map((entry) => ({ entry, claimed: claimed.has(entry.id) }));
  }

  private async renderSample(params: {
    subject: string;
    body: string;
    entry: WaitlistEntry;
  }): Promise<WaitlistEmailSample> {
    const { subject, body, entry } = params;
    const rendered = renderWaitlistEmail({
      subject,
      body,
      values: waitlistEmailValues({
        entry,
        signupLink: withRef(signupUrl(true), SAMPLE_SIGNUP_CODE),
      }),
    });
    if (R.isFailure(rendered)) {
      return { entry, subject: null, html: null, missing: rendered.error };
    }
    return {
      entry,
      subject: rendered.value.subject,
      html: await this.mailService.renderWaitlistStaffEmail({
        ...rendered.value,
        unsubscribeUrl: waitlistUnsubscribeLink(SAMPLE_UNSUBSCRIBE_TOKEN),
      }),
      missing: [],
    };
  }

  async preview(dto: PreviewWaitlistEmailDto): Promise<WaitlistEmailPreview> {
    const candidates = await this.findCandidates(dto.entryIds);
    const defaultSkipReasons = candidates.map((candidate) =>
      skipReason({ candidate, includeClaimed: false }),
    );
    const countSkipped = (reason: WaitlistEmailSkipReason) =>
      defaultSkipReasons.filter((skipped) => skipped === reason).length;
    const recipients = candidates
      .filter(
        (candidate) =>
          skipReason({ candidate, includeClaimed: dto.includeClaimed }) ===
          null,
      )
      .map(({ entry }) => entry);

    const needsOrganization = findWaitlistEmailPlaceholders([
      dto.subject,
      dto.body,
    ]).used.has(WaitlistEmailPlaceholder.OrganizationName);
    const sampleEntry =
      recipients.find((entry) => entry.id === dto.sampleEntryId) ??
      recipients.find((entry) => !needsOrganization || entry.organization) ??
      recipients.at(0);

    return {
      selected: candidates.length,
      unsubscribed: countSkipped(WaitlistEmailSkipReason.Unsubscribed),
      claimed: countSkipped(WaitlistEmailSkipReason.InviteClaimed),
      recipientIds: recipients.map((entry) => entry.id),
      waiting: recipients.filter((entry) => !entry.mobilizedAt).length,
      withoutOrganization: recipients.filter((entry) => !entry.organization)
        .length,
      withoutGroup: recipients.filter(
        (entry) =>
          entry.organization && entry.organization.communityId === null,
      ).length,
      sample: sampleEntry
        ? await this.renderSample({
            subject: dto.subject,
            body: dto.body,
            entry: sampleEntry,
          })
        : null,
    };
  }
}
