import { R } from "@alliance/common/result";
import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
  withoutOrganizationMessage,
} from "@alliance/common/waitlistEmail";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MailService } from "src/mail/mail.service";
import {
  signupUrl,
  waitlistUnsubscribeLink,
  withRef,
} from "src/search/approutes";
import type { Repository } from "src/utils/Repository";
import { DataSource } from "typeorm";
import type {
  SendWaitlistEmailDto,
  WaitlistEmailBatchSummary,
  WaitlistEmailCounts,
} from "./dto/waitlist-email-batch.dto";
import type { WaitlistEmailContentDto } from "./dto/waitlist-email-content.dto";
import type {
  PreviewWaitlistEmailDto,
  WaitlistEmailPreview,
  WaitlistEmailSample,
} from "./dto/waitlist-email.dto";
import { WaitlistEmailBatch } from "./entities/waitlist-email-batch.entity";
import {
  WaitlistEmailRecipient,
  WaitlistEmailRecipientStatus,
} from "./entities/waitlist-email-recipient.entity";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import {
  reachable,
  skipReason,
  type WaitlistEmailCandidate,
  WaitlistEmailSkipReason,
  waitlistEmailValues,
} from "./waitlist-email-audience";
import { renderWaitlistEmail } from "./waitlist-email-render";
import { WaitlistEmailSender } from "./waitlist-email-sender.service";
import { ENTRY_INVITE_CLAIMED_SQL } from "./waitlist-entry-admin.service";

// A preview never issues an invite or carries a real entry's unsubscribe link.
const SAMPLE_SIGNUP_CODE = "SIGNUP-CODE";
const SAMPLE_UNSUBSCRIBE_TOKEN = "00000000-0000-0000-0000-000000000000";

const usesOrganizationName = (content: WaitlistEmailContentDto): boolean =>
  findWaitlistEmailPlaceholders([content.subject, content.body]).used.has(
    WaitlistEmailPlaceholder.OrganizationName,
  );

const zeroCounts = (): WaitlistEmailCounts => ({
  [WaitlistEmailRecipientStatus.Pending]: 0,
  [WaitlistEmailRecipientStatus.Sending]: 0,
  [WaitlistEmailRecipientStatus.Sent]: 0,
  [WaitlistEmailRecipientStatus.Failed]: 0,
  [WaitlistEmailRecipientStatus.Uncertain]: 0,
  [WaitlistEmailRecipientStatus.Skipped]: 0,
});

@Injectable()
export class WaitlistEmailService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WaitlistEntry)
    private readonly entryRepository: Repository<WaitlistEntry>,
    @InjectRepository(WaitlistEmailBatch)
    private readonly batchRepository: Repository<WaitlistEmailBatch>,
    @InjectRepository(WaitlistEmailRecipient)
    private readonly recipientRepository: Repository<WaitlistEmailRecipient>,
    private readonly mailService: MailService,
    private readonly sender: WaitlistEmailSender,
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

  private findRecipients(params: {
    entryIds: number[];
    includeClaimed: boolean;
  }): Promise<WaitlistEmailCandidate[]> {
    return this.findCandidates(params.entryIds).then((candidates) =>
      reachable(candidates, params.includeClaimed),
    );
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
    const recipients = reachable(candidates, dto.includeClaimed).map(
      ({ entry }) => entry,
    );

    const needsOrganization = usesOrganizationName(dto);
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

  /**
   * Fixes the batch's recipients and starts sending. A repeated request id
   * resolves to its batch and adds nobody.
   */
  async send(params: {
    dto: SendWaitlistEmailDto;
    staffUserId: number;
  }): Promise<WaitlistEmailBatchSummary> {
    const { dto, staffUserId } = params;
    const existing = await this.batchRepository.findOneBy({
      requestId: dto.requestId,
    });
    if (existing) {
      return this.findSummary(existing.id);
    }
    if (usesOrganizationName(dto)) {
      const recipients = await this.findRecipients(dto);
      const unaffiliated = recipients.filter(
        ({ entry }) => !entry.organization,
      ).length;
      if (unaffiliated) {
        throw new BadRequestException(withoutOrganizationMessage(unaffiliated));
      }
    }
    const batchId = await this.dataSource.transaction(async (manager) => {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(WaitlistEmailBatch)
        .values({
          requestId: dto.requestId,
          subject: dto.subject,
          body: dto.body,
          mobilize: dto.mobilize,
          includeClaimed: dto.includeClaimed,
          staffUserId,
        })
        .orIgnore()
        .returning("id")
        .execute();
      const [row] = inserted.raw;
      if (!row) {
        return (
          await manager.findOneByOrFail(WaitlistEmailBatch, {
            requestId: dto.requestId,
          })
        ).id;
      }
      await manager.query(
        `INSERT INTO waitlist_email_recipient ("batchId", "entryId")
         SELECT $1, id FROM waitlist_entry WHERE id = ANY($2)`,
        [row.id, dto.entryIds],
      );
      return row.id;
    });
    void this.sender.run();
    return this.findSummary(batchId);
  }

  private async countsFor(
    batchIds: number[],
  ): Promise<Map<number, WaitlistEmailCounts>> {
    const rows = await this.recipientRepository
      .createQueryBuilder("recipient")
      .select("recipient.batchId", "batchId")
      .addSelect("recipient.status", "status")
      .addSelect("count(*)::int", "count")
      .where("recipient.batchId = ANY(:batchIds)", { batchIds })
      .groupBy("recipient.batchId")
      .addGroupBy("recipient.status")
      .getRawMany<{
        batchId: number;
        status: WaitlistEmailRecipientStatus;
        count: number;
      }>();
    const counts = new Map(batchIds.map((id) => [id, zeroCounts()]));
    for (const row of rows) {
      const batchCounts = counts.get(row.batchId);
      if (batchCounts) batchCounts[row.status] = row.count;
    }
    return counts;
  }

  private async findSummary(id: number): Promise<WaitlistEmailBatchSummary> {
    const batch = await this.batchRepository.findOne({
      where: { id },
      relations: { staffUser: true },
    });
    if (!batch) {
      throw new NotFoundException("Waitlist email not found");
    }
    const counts = await this.countsFor([id]);
    return { batch, counts: counts.get(id) ?? zeroCounts() };
  }
}
