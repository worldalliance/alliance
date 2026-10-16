import {
  AWAY_RANGE_NOTE_MISSING,
  hasAwayRangeEnded,
  isAwayRangeActiveAt,
  isAwayRangeNoteMissing,
  isAwayRangeStartLocked,
} from "@alliance/common/awayRange";
import { R } from "@alliance/common/result";
import { DEFAULT_TIME_ZONE } from "@alliance/common/timezone";
import { Temporal } from "@js-temporal/polyfill";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteCascade, writeUnderLive } from "src/datasources/soft-delete";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { DataSource } from "typeorm";
import {
  applyMemberAwayRangeEdit,
  AwayRangeEditor,
  type AwayRangeSpan,
  checkAwayRangeStart,
  type StoredAwayRange,
} from "./away-range-history";
import { CreateAwayRangeDto, UpdateAwayRangeDto } from "./dto/away-range.dto";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "./entities/user-away-range.entity";
import { User } from "./entities/user.entity";
import { type AwayRangesChangedPayload, UserEvents } from "./user.events";
import { UserService } from "./user.service";

@Injectable()
export class UserAwayRangeService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserAwayRange)
    private readonly userAwayRangeRepository: TypedRepository<UserAwayRange>,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private validateAwayRange(
    startDate: Date,
    endDate: Date,
    reason: UserAwayRangeReason,
    note: string | null,
    options?: { validateStartDate?: boolean },
  ): void {
    const { validateStartDate = true } = options ?? {};
    const now = new Date();

    if (startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException("End date must be after start date.");
    }

    const start = checkAwayRangeStart(startDate, now);
    if (validateStartDate && R.isFailure(start)) {
      throw new BadRequestException(start.error);
    }

    if (isAwayRangeNoteMissing({ reason, note })) {
      throw new BadRequestException(AWAY_RANGE_NOTE_MISSING);
    }
  }

  async createAwayRange(params: {
    userId: number;
    data: CreateAwayRangeDto;
    editor: AwayRangeEditor;
  }): Promise<UserAwayRange> {
    const { userId, data, editor } = params;
    const reason = data.reason;
    const note = data.note ?? null;
    const startDay = Temporal.PlainDate.from(data.startDay);
    const endDay = Temporal.PlainDate.from(data.endDay);
    const user = await this.userService.findOneOrFail(userId);
    const tz = user.timeZone ?? DEFAULT_TIME_ZONE;

    const startDate = new Date(
      startDay
        .toZonedDateTime({
          timeZone: tz,
          plainTime: Temporal.PlainTime.from({ hour: 0 }),
        })
        .toInstant().epochMilliseconds,
    );
    const endDate = new Date(
      endDay
        .toZonedDateTime({
          timeZone: tz,
          plainTime: Temporal.PlainTime.from({ hour: 23, minute: 59 }),
        })
        .toInstant().epochMilliseconds,
    );

    const now = new Date();
    const span = this.resolveAwayRangeEdit({
      editor,
      before: null,
      requested: { startDate, endDate },
      now,
    });
    this.validateAwayRange(span.startDate, span.endDate, reason, note);

    // Stamped here rather than by the database, so a start clamped to `now`
    // doesn't read as starting before the range's creation.
    const awayRange = this.userAwayRangeRepository.create({
      userId,
      ...span,
      reason,
      note,
      createdAt: now,
    });

    const saved = await writeUnderLive(this.dataSource.manager, {
      parents: [{ target: User, id: userId }],
      write: (manager) => manager.save(awayRange),
    });
    this.emitAwayRangesChanged(userId);
    return saved;
  }

  async getAwayRanges(userId: number): Promise<UserAwayRange[]> {
    return this.userAwayRangeRepository.find({
      where: { userId },
      order: { startDate: "DESC" },
    });
  }

  /** A member's delete of a range whose start has locked ends it now, or is
   * rejected once it has ended. */
  async deleteAwayRange(params: {
    userId: number;
    awayRangeId: number;
    editor: AwayRangeEditor;
  }): Promise<void> {
    const { userId, awayRangeId, editor } = params;
    const awayRange = await this.userAwayRangeRepository.findOne({
      where: { id: awayRangeId, userId },
    });

    if (!awayRange) {
      throw new NotFoundException("Away range not found.");
    }

    const now = new Date();
    const removes = {
      [AwayRangeEditor.Admin]: true,
      [AwayRangeEditor.Member]: !isAwayRangeStartLocked(awayRange, now),
    } satisfies Record<AwayRangeEditor, boolean>;
    if (removes[editor]) {
      await softDeleteCascade(this.userAwayRangeRepository.manager, {
        target: UserAwayRange,
        ids: [awayRange.id],
      });
      this.emitAwayRangesChanged(userId);
      return;
    }
    if (hasAwayRangeEnded(awayRange, now)) {
      throw new BadRequestException(
        "An away period that has ended can't be deleted.",
      );
    }
    awayRange.endDate = now;
    await this.saveLiveAwayRange(awayRange);
    this.emitAwayRangesChanged(userId);
  }

  async updateAwayRange(params: {
    userId: number;
    awayRangeId: number;
    data: UpdateAwayRangeDto;
    editor: AwayRangeEditor;
  }): Promise<UserAwayRange> {
    const { userId, awayRangeId, data, editor } = params;
    const awayRange = await this.userAwayRangeRepository.findOne({
      where: { id: awayRangeId, userId },
    });

    if (!awayRange) {
      throw new NotFoundException("Away range not found.");
    }

    const user = await this.userService.findOneOrFail(userId);
    const tz = user.timeZone ?? DEFAULT_TIME_ZONE;
    const before = {
      startDate: awayRange.startDate,
      endDate: awayRange.endDate,
      createdAt: awayRange.createdAt,
    };
    // For a member, a day matching the stored one keeps the stored instant,
    // which their create or early end may have set mid-day; an admin's day
    // always means the whole day.
    const keepsStoredInstant = {
      [AwayRangeEditor.Member]: true,
      [AwayRangeEditor.Admin]: false,
    } satisfies Record<AwayRangeEditor, boolean>;
    const isNewDay = (day: string, date: Date) =>
      !keepsStoredInstant[editor] ||
      !Temporal.PlainDate.from(day).equals(
        Temporal.Instant.fromEpochMilliseconds(date.getTime())
          .toZonedDateTimeISO(tz)
          .toPlainDate(),
      );

    if (data.startDay && isNewDay(data.startDay, before.startDate)) {
      const startDay = Temporal.PlainDate.from(data.startDay);
      awayRange.startDate = new Date(
        startDay
          .toZonedDateTime({
            timeZone: tz,
            plainTime: Temporal.PlainTime.from({ hour: 0 }),
          })
          .toInstant().epochMilliseconds,
      );
    }

    if (data.endDay && isNewDay(data.endDay, before.endDate)) {
      const endDay = Temporal.PlainDate.from(data.endDay);
      awayRange.endDate = new Date(
        endDay
          .toZonedDateTime({
            timeZone: tz,
            plainTime: Temporal.PlainTime.from({ hour: 23, minute: 59 }),
          })
          .toInstant().epochMilliseconds,
      );
    }

    Object.assign(
      awayRange,
      this.resolveAwayRangeEdit({
        editor,
        before,
        requested: awayRange,
        now: new Date(),
      }),
    );

    if (data.reason !== undefined) {
      awayRange.reason = data.reason;
    }

    if (data.note !== undefined) {
      awayRange.note = data.note;
    }

    this.validateAwayRange(
      awayRange.startDate,
      awayRange.endDate,
      awayRange.reason,
      awayRange.note,
      { validateStartDate: false },
    );

    const saved = await this.saveLiveAwayRange(awayRange);
    this.emitAwayRangesChanged(userId);
    return saved;
  }

  private saveLiveAwayRange(awayRange: UserAwayRange): Promise<UserAwayRange> {
    return writeUnderLive(this.dataSource.manager, {
      parents: [{ target: User, id: awayRange.userId }],
      saved: { target: UserAwayRange, id: awayRange.id },
      notFound: "Away range not found.",
      write: (manager) => manager.save(awayRange),
    });
  }

  private emitAwayRangesChanged(userId: number): void {
    this.eventEmitter.emit(UserEvents.AwayRangesChanged, {
      userId,
    } satisfies AwayRangesChangedPayload);
  }

  private resolveAwayRangeEdit(params: {
    editor: AwayRangeEditor;
    before: StoredAwayRange | null;
    requested: AwayRangeSpan;
    now: Date;
  }): AwayRangeSpan {
    const { editor, before, requested, now } = params;
    switch (editor) {
      case AwayRangeEditor.Admin:
        return requested;
      case AwayRangeEditor.Member:
        return R.match(applyMemberAwayRangeEdit({ before, requested, now }), {
          success: (span) => span,
          failure: (message) => {
            throw new BadRequestException(message);
          },
        });
      default:
        throw new Error(`unknown away range editor: ${editor satisfies never}`);
    }
  }

  async isUserIdAway(
    userId: number,
    checkDate: Date = new Date(),
  ): Promise<boolean> {
    const awayRanges = await this.userAwayRangeRepository.find({
      where: { userId },
    });

    return awayRanges.some((range) => isAwayRangeActiveAt(range, checkDate));
  }
}
