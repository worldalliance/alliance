import { R, type Result } from '@alliance/common/result';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'src/utils/Repository';
import {
  EventLogDto,
  EventLogList,
  EventLogQueryDto,
} from './dto/event-log.dto';
import { EventLog, EventType, SEND_TO_SLACK } from './event-log.entity';
import { EventLogEvents } from './eventlog.events';
import { escapeSlackText } from './slack-format';

@Injectable()
export class EventLogService {
  private readonly logger = new Logger(EventLogService.name);
  constructor(
    @InjectRepository(EventLog)
    private readonly eventLogRepository: Repository<EventLog>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(query: EventLogQueryDto): Promise<EventLogList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.eventLogRepository
      .createQueryBuilder('eventLog')
      .leftJoinAndSelect('eventLog.user', 'user')
      .orderBy('eventLog.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.eventType) {
      qb.andWhere('eventLog.event = :eventType', {
        eventType: query.eventType,
      });
    }

    const [items, totalCount] = await qb.getManyAndCount();

    return {
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async findOne(id: string): Promise<EventLog | null> {
    return this.eventLogRepository.findOne({
      where: { id },
      relations: { user: true },
    });
  }

  /**
   * Records an event-log entry and forwards it to Slack. Never rejects: a
   * failed event-log write is logged and returned as a failure, so
   * fire-and-forget callers can ignore the Result, while callers for whom the
   * entry is the system of record (e.g. an account-deletion request) unwrap
   * it and surface the error. The Result reflects only the write — once the
   * entry is saved, forwarding (the in-process created event and the Slack
   * copy) is best-effort and a failure there only logs.
   *
   * `message` is stored raw in the event log (and shown in the admin panel);
   * the Slack copy is `escapeSlackText(message)`, so interpolated user text
   * can't inject mentions or links. Pass `slackMessage` only when the Slack
   * copy needs intentional markup (mentions, `<url|label>` links) — it is
   * sent verbatim, so run any untrusted text interpolated into it through
   * `escapeSlackText` yourself.
   */
  async sendMessage(data: {
    type: EventType;
    message: string;
    slackMessage?: string;
    blob: Record<string, unknown> | null;
    userId: number | null;
  }): Promise<Result<void, Error>> {
    const { type, message, blob, userId } = data;

    const saved = await R.fromPromiseFn(() =>
      this.eventLogRepository.save(
        this.eventLogRepository.create({
          event: type,
          message: message,
          blob,
          userId,
        }),
      ),
    );
    if (R.isFailure(saved)) {
      this.logger.error(
        `Failed to record event log message: ${message}`,
        saved.error,
      );
      return saved;
    }

    const forwarded = await R.fromPromiseFn(() =>
      this.forward(saved.value, data),
    );
    if (R.isFailure(forwarded)) {
      this.logger.error(
        `Failed to forward event log message: ${message}`,
        forwarded.error,
      );
    }
    return R.success(undefined);
  }

  private async forward(
    saved: EventLog,
    data: {
      type: EventType;
      message: string;
      slackMessage?: string;
    },
  ): Promise<void> {
    const { type, message } = data;
    const slackMessage = data.slackMessage ?? escapeSlackText(message);

    // Re-query with user relation for the event payload
    const fullEvent = await this.eventLogRepository.findOne({
      where: { id: saved.id },
      relations: { user: true },
    });
    if (fullEvent) {
      this.eventEmitter.emit(
        EventLogEvents.Created,
        new EventLogDto(fullEvent),
      );
    }
    if (!SEND_TO_SLACK[type]) {
      return;
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL is not set; skipping Slack message');
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`Skipping Slack message in development: ${slackMessage}`);
      return;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: slackMessage,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `Failed to send Slack message: ${res.status} ${res.statusText} ${text}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send Slack message: ${slackMessage}`, error);
    }
  }
}
