import type { Result } from "@alliance/common/result";
import { R } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { updateLive } from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { moveNumberOptOut } from "src/mms/mms-number.service";
import { OtpChannel, OtpPurpose } from "src/otp/otp-copy";
import {
  OtpService,
  type OtpStartRefusal,
  type OtpVerifyRefusal,
  type StartedOtp,
} from "src/otp/otp.service";
import { DataSource, In } from "typeorm";
import { User } from "./entities/user.entity";
import { lockPhoneNumber } from "./user.utils";

export const PHONE_PURPOSE = OtpPurpose.PhoneVerification;

@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly otpService: OtpService,
    private readonly eventLogService: EventLogService,
  ) {}

  async start(params: {
    userId: number;
    phoneNumber: string;
    ip: string;
    webOtpHost: string | null;
  }): Promise<Result<StartedOtp, OtpStartRefusal>> {
    const { userId, phoneNumber, ip, webOtpHost } = params;
    const holder = await this.dataSource.getRepository(User).findOne({
      where: { phoneNumber },
      select: { id: true },
    });
    const holdsContact = holder?.id === userId;
    return this.otpService.start({
      purpose: PHONE_PURPOSE,
      contact: { channel: OtpChannel.Sms, destination: phoneNumber },
      requester: { userId, holdsContact },
      ip,
      webOtpHost,
    });
  }

  /**
   * Gives the member the number the code went to, taking it from any other
   * account that holds it: the code shows who has the phone now.
   */
  async verify(params: {
    userId: number;
    challengeToken: string;
    code: string;
    ip: string;
  }): Promise<Result<void, OtpVerifyRefusal>> {
    const { userId, challengeToken, code, ip } = params;
    const verified = await this.otpService.verify({
      purpose: PHONE_PURPOSE,
      browserToken: challengeToken,
      userId,
      code,
      ip,
    });
    if (!verified.ok) return verified;
    const phoneNumber = verified.value.destination;

    const announceMoves = await this.dataSource.transaction(async (manager) => {
      await lockPhoneNumber(manager, phoneNumber);
      // Deleted accounts count for the opt-out, which MmsUnsubService
      // records on them, but keep their number.
      const rows = await manager.find(User, {
        where: [{ phoneNumber }, { id: userId }],
        withDeleted: true,
        order: { id: "ASC" },
        lock: { mode: "pessimistic_write" },
      });
      const holders = rows.filter((row) => row.phoneNumber === phoneNumber);
      const others = holders.filter(
        (holder) => holder.id !== userId && holder.deletedAt === null,
      );
      const verifiedBy = rows.find((row) => row.id === userId);
      if (!verifiedBy) throw new Error(`User ${userId} not found`);
      const optedOut = await moveNumberOptOut(manager, {
        from: verifiedBy,
        to: phoneNumber,
      });
      await manager.update(
        User,
        { id: In(others.map((holder) => holder.id)), phoneNumber },
        {
          phoneNumber: null,
          phoneNumberVerifiedAt: null,
          phoneNumberUnsubscribed: false,
        },
      );
      await updateLive(manager, {
        target: User,
        id: userId,
        changes: {
          phoneNumber,
          phoneNumberVerifiedAt: new Date(),
          // A STOP belongs to the number, whichever account holds it.
          phoneNumberUnsubscribed: optedOut,
        },
        notFound: `User ${userId} not found`,
      });
      // The event is the only record of the number the holder had.
      const announcements: Array<() => Promise<void>> = [];
      for (const holder of others) {
        announcements.push(
          await this.eventLogService.sendMessageInTransaction(manager, {
            type: EventType.PhoneNumberMoved,
            payload: { phoneNumber, previous: holder, verifiedBy },
            userId: holder.id,
            blob: { phoneNumber, verifiedByUserId: userId },
          }),
        );
      }
      return announcements;
    });

    for (const announce of announceMoves) await announce();
    return R.success(undefined);
  }
}
