import { NodeEnv } from "@alliance/common/node-env";
import { isCanonicalE164 } from "@alliance/common/phone";
import { R, type Result } from "@alliance/common/result";
import { NON_MEMBER_REPLY_WINDOW_DAYS } from "@alliance/common/staffText";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { env } from "src/config/env";
import { OptOutSource } from "src/mms/opt-out-source";
import { User } from "src/user/entities/user.entity";
import { isAnonymizedPhoneNumber } from "src/utils/phone";
import type { Repository } from "src/utils/Repository";
import { In, MoreThan } from "typeorm";
import { z } from "zod";
import {
  MmsInboxService,
  type NumberMark,
  ReplyState,
} from "./mms-inbox.service";
import { MmsMedia } from "./mms-media.entity";
import { MmsNumberService } from "./mms-number.service";
import { MmsThread } from "./mms-thread.entity";
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

export type MmsThreadView = {
  phoneNumber: string | null;
  textable: boolean;
  optedOut: boolean;
  replyState: ReplyState;
  messages: Mms[];
  hasOlder: boolean;
};

export type NumberThread = {
  thread: MmsThread;
  members: User[];
  textable: boolean;
  optedOut: boolean;
  replyWindowClosed: boolean;
  messages: Mms[];
  hasOlder: boolean;
};

export const THREAD_PAGE_SIZE = 100;

const THREAD_RELATIONS = {
  sentBy: true,
  media: true,
  threadEvents: { markedBy: true },
} as const;

export enum ThreadRefusal {
  MemberNotFound = "member_not_found",
  TextNotInThread = "text_not_in_thread",
  ThreadNotFound = "thread_not_found",
}

export type ThreadMark = {
  userId: number;
  throughId: number;
  adminId: number;
};

export enum StaffTextRefusal {
  NoPhoneNumber = "no_phone_number",
  InvalidNumber = "invalid_number",
  OptedOut = "opted_out",
  ReplyWindowClosed = "reply_window_closed",
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

declare const textable: unique symbol;
type TextableNumber = string & { readonly [textable]: true };
declare const reachable: unique symbol;
type ReachableNumber = TextableNumber & { readonly [reachable]: true };

const checkTextable = (
  phoneNumber: string,
): Result<TextableNumber, StaffTextRefusal.InvalidNumber> =>
  textableNumber(phoneNumber)
    ? // Safe: textableNumber just checked it, and only here brands a number.
      R.success(phoneNumber as TextableNumber)
    : R.failure(StaffTextRefusal.InvalidNumber);

const memberNumber = (
  user: User,
): Result<
  TextableNumber,
  StaffTextRefusal.NoPhoneNumber | StaffTextRefusal.InvalidNumber
> =>
  user.phoneNumber
    ? checkTextable(user.phoneNumber)
    : R.failure(StaffTextRefusal.NoPhoneNumber);

@Injectable()
export class MmsThreadService {
  constructor(
    @InjectRepository(Mms)
    private readonly mmsRepository: Repository<Mms>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MmsThread)
    private readonly threadRepository: Repository<MmsThread>,
    private readonly mmsService: MmsService,
    private readonly mmsUnsubService: MmsUnsubService,
    private readonly mmsNumberService: MmsNumberService,
    private readonly mmsInboxService: MmsInboxService,
  ) {}

  /** Twilio retries a webhook it timed out on, so a repeat SID records nothing. */
  async recordInbound(text: InboundText): Promise<MmsMedia[]> {
    return this.mmsRepository.manager.transaction(async (manager) => {
      await this.mmsNumberService.ensureThread(text.from, manager);
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
  }): Promise<Result<MmsThreadView, ThreadRefusal>> {
    const user = await this.findMember(params.userId);
    if (!user.ok) return user;
    const { phoneNumber } = user.value;
    const [page, optedOut] = await Promise.all([
      this.threadPage(phoneNumber, params.before),
      phoneNumber ? this.mmsNumberService.optedOut(phoneNumber) : false,
    ]);
    if (!page.ok) return page;
    return R.success({
      phoneNumber,
      textable: memberNumber(user.value).ok,
      optedOut,
      replyState: phoneNumber
        ? await this.mmsInboxService.replyState(phoneNumber)
        : ReplyState.Answered,
      ...page.value,
    });
  }

  private async inThread(phoneNumber: string | null, id: number) {
    return (
      phoneNumber !== null &&
      this.mmsRepository.exists({
        where: { id, memberPhoneNumber: phoneNumber },
        withDeleted: true,
      })
    );
  }

  async getNumberThread(params: {
    threadId: string;
    before?: number;
  }): Promise<Result<NumberThread, ThreadRefusal>> {
    const thread = await this.findThread(params.threadId);
    if (!thread.ok) return thread;
    const { phoneNumber } = thread.value;
    const [page, members, optedOut] = await Promise.all([
      this.threadPage(phoneNumber, params.before),
      this.membersOn(phoneNumber),
      this.mmsNumberService.optedOut(phoneNumber),
    ]);
    if (!page.ok) return page;
    return R.success({
      thread: thread.value,
      members,
      textable: textableNumber(phoneNumber),
      optedOut,
      replyWindowClosed: await this.replyWindowClosed({
        phoneNumber,
        members,
      }),
      ...page.value,
    });
  }

  private async threadPage(
    phoneNumber: string | null,
    before: number | undefined,
  ): Promise<
    Result<
      Pick<MmsThreadView, "messages" | "hasOlder">,
      ThreadRefusal.TextNotInThread
    >
  > {
    const beforeInThread =
      before === undefined || (await this.inThread(phoneNumber, before));
    if (!beforeInThread) return R.failure(ThreadRefusal.TextNotInThread);
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
      relations: THREAD_RELATIONS,
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
    const { userId, ...rest } = params;
    const user = await this.findMember(userId);
    if (!user.ok) return user;
    return this.sendStaffText({
      ...rest,
      to: await this.staffTextable(memberNumber(user.value)),
    });
  }

  async sendInThread(params: {
    threadId: string;
    body: string;
    adminId: number;
  }): Promise<
    Result<
      Mms,
      ThreadRefusal.ThreadNotFound | StaffTextRefusal | StaffSendFailure
    >
  > {
    const { threadId, ...rest } = params;
    const thread = await this.findThread(threadId);
    if (!thread.ok) return thread;
    return this.sendStaffText({
      ...rest,
      to: await this.replyableNumber(thread.value.phoneNumber),
    });
  }

  async markOptedOut(params: {
    userId: number;
    adminId: number;
  }): Promise<Result<void, ThreadRefusal.MemberNotFound | StaffTextRefusal>> {
    const user = await this.findMember(params.userId);
    if (!user.ok) return user;
    return this.markNumberOptedOut({
      number: memberNumber(user.value),
      adminId: params.adminId,
    });
  }

  async markOptedOutInThread(params: {
    threadId: string;
    adminId: number;
  }): Promise<Result<void, ThreadRefusal.ThreadNotFound | StaffTextRefusal>> {
    const thread = await this.findThread(params.threadId);
    if (!thread.ok) return thread;
    return this.markNumberOptedOut({
      number: checkTextable(thread.value.phoneNumber),
      adminId: params.adminId,
    });
  }

  private async sendStaffText(params: {
    to: Result<ReachableNumber, StaffTextRefusal>;
    body: string;
    adminId: number;
  }): Promise<Result<Mms, StaffTextRefusal | StaffSendFailure>> {
    const { to, body, adminId } = params;
    if (!to.ok) return to;
    const threadId = await this.mmsNumberService.ensureThread(to.value);
    const sent = await this.mmsService.sendStaffText({
      to: to.value,
      threadId,
      body,
      sentById: adminId,
    });
    if (!sent.ok) return sent;
    const mms = await this.mmsRepository.findOneOrFail({
      where: { id: sent.value.id },
      relations: THREAD_RELATIONS,
    });
    return R.success(mms);
  }

  private async markNumberOptedOut(params: {
    number: Result<TextableNumber, StaffTextRefusal>;
    adminId: number;
  }): Promise<Result<void, StaffTextRefusal>> {
    const to = await this.staffTextable(params.number);
    if (!to.ok) return to;
    await this.mmsUnsubService.unsubFromMms(to.value, {
      kind: OptOutSource.Staff,
      adminId: params.adminId,
    });
    return R.success(undefined);
  }

  async markHandled(params: ThreadMark): Promise<Result<void, ThreadRefusal>> {
    const mark = await this.numberMark(params);
    if (!mark.ok) return mark;
    await this.mmsInboxService.markHandled(mark.value);
    return R.success(undefined);
  }

  async markNeedsReply(
    params: ThreadMark,
  ): Promise<Result<void, ThreadRefusal>> {
    const mark = await this.numberMark(params);
    if (!mark.ok) return mark;
    await this.mmsInboxService.markNeedsReply(mark.value);
    return R.success(undefined);
  }

  private async numberMark(
    params: ThreadMark,
  ): Promise<Result<NumberMark, ThreadRefusal>> {
    const { userId, ...mark } = params;
    const user = await this.findMember(userId);
    if (!user.ok) return user;
    const { phoneNumber } = user.value;
    if (!phoneNumber || !(await this.inThread(phoneNumber, mark.throughId))) {
      return R.failure(ThreadRefusal.TextNotInThread);
    }
    return R.success({ ...mark, phoneNumber });
  }

  private async staffTextable(
    number: Result<TextableNumber, StaffTextRefusal>,
  ): Promise<Result<ReachableNumber, StaffTextRefusal>> {
    if (!number.ok) return number;
    if (await this.mmsNumberService.optedOut(number.value)) {
      return R.failure(StaffTextRefusal.OptedOut);
    }
    // Safe: the number just passed the opt-out check, and only here brands one.
    return R.success(number.value as ReachableNumber);
  }

  /** A member's number, or a non-member's that texted within the window.
   * Opt-out is checked first, since staff can't wait it out as they can the
   * window. */
  private async replyableNumber(
    phoneNumber: string,
  ): Promise<Result<ReachableNumber, StaffTextRefusal>> {
    const number = await this.staffTextable(checkTextable(phoneNumber));
    if (!number.ok) return number;
    const members = await this.membersOn(phoneNumber);
    if (await this.replyWindowClosed({ phoneNumber, members })) {
      return R.failure(StaffTextRefusal.ReplyWindowClosed);
    }
    return number;
  }

  private async replyWindowClosed(params: {
    phoneNumber: string;
    members: User[];
  }): Promise<boolean> {
    const { phoneNumber, members } = params;
    if (members.length > 0) return false;
    const since = new Date(
      Date.now() - milliseconds({ days: NON_MEMBER_REPLY_WINDOW_DAYS }),
    );
    return !(await this.mmsRepository.exists({
      where: {
        memberPhoneNumber: phoneNumber,
        direction: MmsDirection.Inbound,
        createdAt: MoreThan(since),
      },
    }));
  }

  /** Non-deleted members. */
  private membersOn(phoneNumber: string): Promise<User[]> {
    return this.userRepository.find({
      where: { phoneNumber },
      order: { id: "ASC" },
    });
  }

  private async findMember(
    userId: number,
  ): Promise<Result<User, ThreadRefusal.MemberNotFound>> {
    const user = await this.userRepository.findOneBy({ id: userId });
    return user ? R.success(user) : R.failure(ThreadRefusal.MemberNotFound);
  }

  private async findThread(
    threadId: string,
  ): Promise<Result<MmsThread, ThreadRefusal.ThreadNotFound>> {
    const thread = await this.threadRepository.findOneBy({ id: threadId });
    return thread ? R.success(thread) : R.failure(ThreadRefusal.ThreadNotFound);
  }
}
