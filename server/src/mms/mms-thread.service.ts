import { NodeEnv } from "@alliance/common/node-env";
import { isCanonicalE164 } from "@alliance/common/phone";
import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { env } from "src/config/env";
import { User } from "src/user/entities/user.entity";
import { isAnonymizedPhoneNumber } from "src/utils/phone";
import type { Repository } from "src/utils/Repository";
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

export enum StaffTextRefusal {
  NoPhoneNumber = "no_phone_number",
  InvalidNumber = "invalid_number",
  OptedOut = "opted_out",
}

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

  private async findMember(
    userId: number,
  ): Promise<Result<User, ThreadRefusal.MemberNotFound>> {
    const user = await this.userRepository.findOneBy({ id: userId });
    return user ? R.success(user) : R.failure(ThreadRefusal.MemberNotFound);
  }
}
