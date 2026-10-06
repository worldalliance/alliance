import { R, type Result } from "@alliance/common/result";
import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
  withoutOrganizationMessage,
} from "@alliance/common/waitlistEmail";
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MailService, type WaitlistStaffEmail } from "src/mail/mail.service";
import {
  signupUrl,
  waitlistUnsubscribeLink,
  withRef,
} from "src/search/approutes";
import { UserService } from "src/user/user.service";
import type { Repository } from "src/utils/Repository";
import { DataSource, In, IsNull, Not } from "typeorm";
import type {
  SendWaitlistEmailDto,
  TestWaitlistEmailDto,
  WaitlistEmailBatchDetail,
  WaitlistEmailBatchSummary,
  WaitlistEmailCounts,
} from "./dto/waitlist-email-batch.dto";
import type { WaitlistEmailContentDto } from "./dto/waitlist-email-content.dto";
import type {
  PreviewWaitlistEmailDto,
  WaitlistEmailPreview,
  WaitlistEmailSample,
} from "./dto/waitlist-email.dto";
import { WaitlistInvitePlacement } from "./dto/waitlist-entry-admin.dto";
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
import {
  missingValuesMessage,
  renderWaitlistEmail,
} from "./waitlist-email-render";
import {
  sendOutcome,
  WaitlistEmailSender,
} from "./waitlist-email-sender.service";
import { ENTRY_INVITE_CLAIMED_SQL } from "./waitlist-entry-admin.service";
import {
  findFullCommunityIds,
  invitePlacement,
} from "./waitlist-invite.service";

// Previews and test sends never issue an invite or carry a real entry's
// unsubscribe link.
const SAMPLE_SIGNUP_CODE = "SIGNUP-CODE";
const SAMPLE_UNSUBSCRIBE_TOKEN = "00000000-0000-0000-0000-000000000000";

const usesOrganizationName = (content: WaitlistEmailContentDto): boolean =>
  findWaitlistEmailPlaceholders([content.subject, content.body]).used.has(
    WaitlistEmailPlaceholder.OrganizationName,
  );

// Counts toward a repeat send: the email may have reached, or may still reach,
// the inbox.
const MAY_REACH_INBOX: Record<WaitlistEmailRecipientStatus, boolean> = {
  [WaitlistEmailRecipientStatus.Pending]: true,
  [WaitlistEmailRecipientStatus.Sending]: true,
  [WaitlistEmailRecipientStatus.Sent]: true,
  [WaitlistEmailRecipientStatus.Uncertain]: true,
  [WaitlistEmailRecipientStatus.Failed]: false,
  [WaitlistEmailRecipientStatus.Skipped]: false,
};
const REPEAT_STATUSES = Object.values(WaitlistEmailRecipientStatus).filter(
  (status) => MAY_REACH_INBOX[status],
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
    private readonly userService: UserService,
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

  /** Needs the entries' organizations loaded. */
  private async placements(
    entries: WaitlistEntry[],
  ): Promise<WaitlistInvitePlacement[]> {
    const communityIds = new Set(
      entries.flatMap((entry) => entry.organization?.communityId ?? []),
    );
    const full = await findFullCommunityIds(
      this.dataSource.manager,
      communityIds,
    );
    return entries.map((entry) =>
      invitePlacement(
        {
          organizationId: entry.organizationId,
          communityId: entry.organization?.communityId ?? null,
        },
        full,
      ),
    );
  }

  private async countAlreadySent(params: {
    entryIds: number[];
    subject: string;
  }): Promise<number> {
    const row = await this.recipientRepository
      .createQueryBuilder("recipient")
      .innerJoin("recipient.batch", "batch")
      .select('count(DISTINCT recipient."entryId")::int', "count")
      .where("recipient.entryId = ANY(:entryIds)", {
        entryIds: params.entryIds,
      })
      .andWhere("recipient.status = ANY(:statuses)", {
        statuses: REPEAT_STATUSES,
      })
      .andWhere("batch.subject = :subject", { subject: params.subject })
      .getRawOne<{ count: number }>();
    return row?.count ?? 0;
  }

  private sampleEmail(params: {
    content: WaitlistEmailContentDto;
    entry: WaitlistEntry;
  }): Result<WaitlistStaffEmail, WaitlistEmailPlaceholder[]> {
    const { content, entry } = params;
    return R.map(
      renderWaitlistEmail({
        subject: content.subject,
        body: content.body,
        values: waitlistEmailValues({
          entry,
          signupLink: withRef(signupUrl(true), SAMPLE_SIGNUP_CODE),
        }),
      }),
      (rendered) => ({
        ...rendered,
        unsubscribeUrl: waitlistUnsubscribeLink(SAMPLE_UNSUBSCRIBE_TOKEN),
      }),
    );
  }

  private async renderSample(params: {
    content: WaitlistEmailContentDto;
    entry: WaitlistEntry;
  }): Promise<WaitlistEmailSample> {
    const { entry } = params;
    const sample = this.sampleEmail(params);
    if (R.isFailure(sample)) {
      return { entry, subject: null, html: null, missing: sample.error };
    }
    return {
      entry,
      subject: sample.value.subject,
      html: await this.mailService.renderWaitlistStaffEmail(sample.value),
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
    const recipientIds = recipients.map((entry) => entry.id);
    const [alreadySent, placements] = await Promise.all([
      this.countAlreadySent({ entryIds: recipientIds, subject: dto.subject }),
      this.placements(recipients),
    ]);
    const countPlaced = (placement: WaitlistInvitePlacement) =>
      placements.filter((placed) => placed === placement).length;

    const needsOrganization = usesOrganizationName(dto);
    const sampleEntry =
      recipients.find((entry) => entry.id === dto.sampleEntryId) ??
      recipients.find((entry) => !needsOrganization || entry.organization) ??
      recipients.at(0);

    return {
      selected: candidates.length,
      noEmail: countSkipped(WaitlistEmailSkipReason.NoEmail),
      unsubscribed: countSkipped(WaitlistEmailSkipReason.Unsubscribed),
      spam: countSkipped(WaitlistEmailSkipReason.Spam),
      claimed: countSkipped(WaitlistEmailSkipReason.InviteClaimed),
      recipientIds,
      waiting: recipients.filter((entry) => !entry.mobilizedAt).length,
      withoutOrganization: countPlaced(WaitlistInvitePlacement.NoOrganization),
      withoutGroup: countPlaced(WaitlistInvitePlacement.NoGroup),
      inFullGroup: countPlaced(WaitlistInvitePlacement.FullGroup),
      alreadySent,
      sample: sampleEntry
        ? await this.renderSample({ content: dto, entry: sampleEntry })
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
    if (
      !(await this.entryRepository.existsBy({
        id: In(dto.entryIds),
        email: Not(IsNull()),
      }))
    ) {
      throw new BadRequestException("No selected entry has an email address");
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

  async findSummaries(): Promise<WaitlistEmailBatchSummary[]> {
    const batches = await this.batchRepository.find({
      relations: { staffUser: true },
      order: { id: "DESC" },
    });
    const counts = await this.countsFor(batches.map((batch) => batch.id));
    return batches.map((batch) => ({
      batch,
      counts: counts.get(batch.id) ?? zeroCounts(),
    }));
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

  async findDetail(id: number): Promise<WaitlistEmailBatchDetail> {
    const [summary, recipients] = await Promise.all([
      this.findSummary(id),
      this.recipientRepository.find({
        select: {
          id: true,
          entryId: true,
          status: true,
          skipReason: true,
          error: true,
          acceptedAt: true,
          entry: { id: true, name: true, email: true, phoneNumber: true },
        },
        where: { batchId: id },
        relations: { entry: true },
        order: { id: "ASC" },
      }),
    ]);
    return { ...summary, recipients };
  }

  /**
   * Queues failed recipients again, and uncertain ones only when asked, since
   * their email may have gone out. Sent recipients are never resent.
   */
  async retry(params: {
    id: number;
    includeUncertain: boolean;
  }): Promise<WaitlistEmailBatchSummary> {
    if (!(await this.batchRepository.existsBy({ id: params.id }))) {
      throw new NotFoundException("Waitlist email not found");
    }
    await this.recipientRepository.update(
      {
        batchId: params.id,
        status: In([
          WaitlistEmailRecipientStatus.Failed,
          ...(params.includeUncertain
            ? [WaitlistEmailRecipientStatus.Uncertain]
            : []),
        ]),
      },
      { status: WaitlistEmailRecipientStatus.Pending, error: null },
    );
    void this.sender.run();
    return this.findSummary(params.id);
  }

  /** Emails the staff member a [Test] copy with the entry's values and sample links. */
  async sendTest(params: {
    dto: TestWaitlistEmailDto;
    staffUserId: number;
  }): Promise<void> {
    const { dto, staffUserId } = params;
    const [staff, entry] = await Promise.all([
      this.userService.findOneOrFail(staffUserId),
      this.entryRepository.findOne({
        where: { id: dto.entryId },
        relations: { organization: true },
      }),
    ]);
    if (!entry) {
      throw new NotFoundException("Waitlist entry not found");
    }
    const sample = this.sampleEmail({ content: dto, entry });
    if (R.isFailure(sample)) {
      throw new BadRequestException(missingValuesMessage(sample.error));
    }
    const sent = await R.fromPromise(
      this.mailService.sendWaitlistStaffEmail({
        recipient: staff.email,
        content: { ...sample.value, subject: `[Test] ${sample.value.subject}` },
      }),
    );
    const outcome = sendOutcome(sent);
    switch (outcome.status) {
      case WaitlistEmailRecipientStatus.Sent:
        return;
      case WaitlistEmailRecipientStatus.Pending:
      case WaitlistEmailRecipientStatus.Failed:
        throw new BadGatewayException(
          `The test email failed: ${outcome.error}`,
        );
      case WaitlistEmailRecipientStatus.Uncertain:
        throw new BadGatewayException(
          `The test email may have gone out anyway; check your inbox before sending another: ${outcome.error}`,
        );
      default:
        throw new Error(
          `unknown send outcome: ${outcome.status satisfies never}`,
        );
    }
  }
}
