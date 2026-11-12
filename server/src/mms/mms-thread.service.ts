import { NodeEnv } from "@alliance/common/node-env";
import { isCanonicalE164 } from "@alliance/common/phone";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { env } from "src/config/env";
import { User } from "src/user/entities/user.entity";
import { isAnonymizedPhoneNumber } from "src/utils/phone";
import type { Repository } from "src/utils/Repository";
import type { MessageStatus } from "twilio/lib/rest/api/v2010/account/message";
import { In } from "typeorm";
import { z } from "zod";
import { MmsMedia } from "./mms-media.entity";
import { MmsUnsubService } from "./mms-unsub.service";
import { Mms, MmsDirection, type MmsKeyword } from "./mms.entity";
import { MmsService, type StaffSendFailure } from "./mms.service";

export type InboundText = {
  sid: string;
  from: string;
  to: string;
  body: string;
  keyword: MmsKeyword | null;
  media: { url: string; contentType: string }[];
};

export type MmsThread = {
  phoneNumber: string | null;
  textable: boolean;
  optedOut: boolean;
  messages: Mms[];
  hasOlder: boolean;
};

export const THREAD_PAGE_SIZE = 100;

export enum ThreadRefusal {
  MemberNotFound = "member_not_found",
  BeforeNotInThread = "before_not_in_thread",
}

export type NeedsReplyMember = {
  user: User;
  lastMessageBody: string;
  waitingSince: Date;
};

export enum StaffTextRefusal {
  NoPhoneNumber = "no_phone_number",
  InvalidNumber = "invalid_number",
  OptedOut = "opted_out",
}

const ANSWERS_MEMBER: Record<MessageStatus, boolean> = {
  queued: true,
  sending: true,
  sent: true,
  delivered: true,
  accepted: true,
  scheduled: true,
  read: true,
  partially_delivered: true,
  failed: false,
  undelivered: false,
  canceled: false,
  receiving: false,
  received: false,
};

const ANSWERING_STATUSES = Object.entries(ANSWERS_MEMBER)
  .filter(([, answers]) => answers)
  .map(([status]) => status);

/** Staging's anonymized numbers pass there, so staff texting can be tried on
 * staging; in production they are unassigned 555 numbers no text would reach. */
const ANONYMIZED_NUMBERS_TEXTABLE: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: false,
  [NodeEnv.Staging]: true,
  [NodeEnv.Development]: true,
  [NodeEnv.Test]: true,
};

const textableNumber = (phoneNumber: string): boolean =>
  isCanonicalE164(phoneNumber) ||
  (ANONYMIZED_NUMBERS_TEXTABLE[env("NODE_ENV")] &&
    isAnonymizedPhoneNumber(phoneNumber));

const memberNumber = (
  user: User,
): Result<
  string,
  StaffTextRefusal.NoPhoneNumber | StaffTextRefusal.InvalidNumber
> => {
  if (!user.phoneNumber) return R.failure(StaffTextRefusal.NoPhoneNumber);
  if (!textableNumber(user.phoneNumber)) {
    return R.failure(StaffTextRefusal.InvalidNumber);
  }
  return R.success(user.phoneNumber);
};

const staffTextableNumber = (user: User): Result<string, StaffTextRefusal> => {
  const number = memberNumber(user);
  if (number.ok && user.phoneNumberUnsubscribed) {
    return R.failure(StaffTextRefusal.OptedOut);
  }
  return number;
};

@Injectable()
export class MmsThreadService {
  constructor(
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mmsService: MmsService,
    private readonly mmsUnsubService: MmsUnsubService,
  ) {}

  /** Twilio retries a webhook it timed out on, so a repeat SID records nothing. */
  async recordInbound(text: InboundText): Promise<MmsMedia[]> {
    return this.mmsRepository.manager.transaction(async (manager) => {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(Mms)
        .values({
          to: text.to,
          from: text.from,
          body: text.body,
          direction: MmsDirection.Inbound,
          keyword: text.keyword,
          status: "received",
          twilioSid: text.sid,
          errorCode: null,
          errorMessage: null,
          cid: null,
          sentById: null,
        })
        .orIgnore()
        .returning(["id"])
        .execute();
      const row: unknown = inserted.raw[0];
      if (row === undefined) return [];
      const { id: mmsId } = z.object({ id: z.coerce.number() }).parse(row);
      const mediaRepository = manager.getRepository(MmsMedia);
      return mediaRepository.save(
        text.media.map(({ url, contentType }) =>
          mediaRepository.create({
            mmsId,
            twilioUrl: url,
            contentType,
            s3Key: null,
          }),
        ),
      );
    });
  }

  /** The newest page of texts sent before the `before` text, oldest first. */
  async getThread(params: {
    userId: number;
    before?: number;
  }): Promise<Result<MmsThread, ThreadRefusal>> {
    const user = await this.findMember(params.userId);
    if (!user.ok) return user;
    const page = await this.threadPage(user.value.phoneNumber, params.before);
    if (!page.ok) return page;
    return R.success({
      phoneNumber: user.value.phoneNumber,
      textable: memberNumber(user.value).ok,
      optedOut: user.value.phoneNumberUnsubscribed,
      ...page.value,
    });
  }

  private async threadPage(
    phoneNumber: string | null,
    before: number | undefined,
  ): Promise<
    Result<
      Pick<MmsThread, "messages" | "hasOlder">,
      ThreadRefusal.BeforeNotInThread
    >
  > {
    const beforeInThread =
      before === undefined ||
      (phoneNumber !== null &&
        (await this.mmsRepository.exists({
          where: { id: before, memberPhoneNumber: phoneNumber },
          withDeleted: true,
        })));
    if (!beforeInThread) return R.failure(ThreadRefusal.BeforeNotInThread);
    if (!phoneNumber) return R.success({ messages: [], hasOlder: false });
    const query = this.mmsRepository
      .createQueryBuilder("mms")
      .select("mms.id")
      .where("mms.memberPhoneNumber = :phoneNumber", { phoneNumber })
      .orderBy("mms.createdAt", "DESC")
      .addOrderBy("mms.id", "DESC")
      .limit(THREAD_PAGE_SIZE + 1);
    if (before !== undefined) {
      query.andWhere(
        `(mms."createdAt", mms.id) < (SELECT "createdAt", id FROM mms WHERE id = :before)`,
        { before },
      );
    }
    const ids = (await query.getMany()).map((m) => m.id);
    const messages = await this.mmsRepository.find({
      where: { id: In(ids.slice(0, THREAD_PAGE_SIZE)) },
      relations: { sentBy: true, media: true },
      order: { createdAt: "ASC", id: "ASC", media: { id: "ASC" } },
    });
    return R.success({ messages, hasOlder: ids.length > THREAD_PAGE_SIZE });
  }

  async send(params: {
    userId: number;
    body: string;
    adminId: number;
  }): Promise<
    Result<
      Mms,
      ThreadRefusal.MemberNotFound | StaffTextRefusal | StaffSendFailure
    >
  > {
    const { userId, body, adminId } = params;
    const user = await this.findMember(userId);
    if (!user.ok) return user;
    const to = staffTextableNumber(user.value);
    if (!to.ok) return to;
    const sent = await this.mmsService.sendStaffText({
      to: to.value,
      userId,
      body,
      sentById: adminId,
    });
    if (!sent.ok) return sent;
    const mms = await this.mmsRepository.findOneOrFail({
      where: { id: sent.value.id },
      relations: { sentBy: true, media: true },
    });
    return R.success(mms);
  }

  async markOptedOut(params: {
    userId: number;
    adminId: number;
  }): Promise<Result<void, ThreadRefusal.MemberNotFound | StaffTextRefusal>> {
    const user = await this.findMember(params.userId);
    if (!user.ok) return user;
    const to = staffTextableNumber(user.value);
    if (!to.ok) return to;
    await this.mmsUnsubService.unsubFromMms(to.value, {
      reason: `marked_by_staff:${params.adminId}`,
      rawBody: "",
    });
    return R.success(undefined);
  }

  /** Longest-waiting first, timed from each number's oldest unanswered text.
   * STOP and START texts, which the webhook acts on and Twilio answers, neither
   * list a member nor hide an earlier text that needs a reply. */
  async needsReply(): Promise<NeedsReplyMember[]> {
    const oldestTexts = await this.unansweredTexts();
    if (oldestTexts.length === 0) return [];
    const users = await this.subscribedMembers()
      .andWhere("member.phoneNumber = ANY(:phoneNumbers)", {
        phoneNumbers: oldestTexts.map((m) => m.memberPhoneNumber),
      })
      .orderBy("member.id")
      .getMany();
    const usersByNumber = Map.groupBy(users, (user) => user.phoneNumber);
    return oldestTexts
      .toSorted(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
      )
      .flatMap((oldest) =>
        (usersByNumber.get(oldest.memberPhoneNumber) ?? []).map((user) => ({
          user,
          lastMessageBody: oldest.lastMessageBody,
          waitingSince: oldest.createdAt,
        })),
      );
  }

  /** Per subscribed number, its oldest inbound text that no staff reply has
   * followed, with the latest such text's body as `lastMessageBody`. The window
   * runs before `DISTINCT ON` keeps each number's first row. */
  private async unansweredTexts() {
    const rows = await this.mmsRepository
      .createQueryBuilder("inbound")
      .select("inbound.id", "id")
      .addSelect("inbound.memberPhoneNumber", "memberPhoneNumber")
      .addSelect("inbound.createdAt", "createdAt")
      .distinctOn(["inbound.memberPhoneNumber"])
      .addSelect(
        `first_value(inbound.body) OVER (
          PARTITION BY inbound."memberPhoneNumber"
          ORDER BY inbound."createdAt" DESC, inbound.id DESC
        )`,
        "lastMessageBody",
      )
      .where("inbound.direction = :inbound", {
        inbound: MmsDirection.Inbound,
      })
      .andWhere("inbound.keyword IS NULL")
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM mms reply
          WHERE reply."memberPhoneNumber" = inbound."memberPhoneNumber"
            AND reply."deletedAt" IS NULL
            AND (reply."createdAt", reply.id) > (inbound."createdAt", inbound.id)
            AND reply."sentById" IS NOT NULL
            AND reply.status IN (:...answering)
        )`,
        { answering: ANSWERING_STATUSES },
      )
      .andWhere(
        `inbound."memberPhoneNumber" IN (${this.subscribedMembers()
          .select("member.phoneNumber")
          .getQuery()})`,
      )
      .orderBy("inbound.memberPhoneNumber")
      .addOrderBy("inbound.createdAt", "ASC")
      .addOrderBy("inbound.id", "ASC")
      .getRawMany();
    return z
      .array(
        z.object({
          id: z.number(),
          memberPhoneNumber: z.string(),
          createdAt: z.date(),
          lastMessageBody: z.string(),
        }),
      )
      .parse(rows);
  }

  private subscribedMembers() {
    return this.userRepository
      .createQueryBuilder("member")
      .where("member.phoneNumberUnsubscribed = false");
  }

  private async findMember(
    userId: number,
  ): Promise<Result<User, ThreadRefusal.MemberNotFound>> {
    const user = await this.userRepository.findOneBy({ id: userId });
    return user ? R.success(user) : R.failure(ThreadRefusal.MemberNotFound);
  }
}
