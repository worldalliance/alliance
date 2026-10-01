import { R, type Result } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import type { DeepPartial, EntityManager } from "typeorm";
import {
  EventLogDto,
  EventLogList,
  EventLogQueryDto,
} from "./dto/event-log.dto";
import { EventLog, EventType, SEND_TO_SLACK } from "./event-log.entity";
import { EventLogEvents } from "./eventlog.events";
import { escapeSlackText } from "./slack-format";

export interface EventLogMessage {
  type: EventType;
  message: string;
  slackMessage?: string;
  blob: Record<string, unknown> | null;
  userId: number | null;
}

function toEntity(data: EventLogMessage): DeepPartial<EventLog> {
  return {
    event: data.type,
    message: data.message,
    blob: data.blob,
    userId: data.userId,
  };
}

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
      .createQueryBuilder("eventLog")
      .leftJoinAndSelect("eventLog.user", "user")
      .orderBy("eventLog.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query.eventType) {
      qb.andWhere("eventLog.event = :eventType", {
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
   * When the entry must be atomic with the change it records rather than
   * merely surfaced, use {@link sendMessageInTransaction}.
   *
   * `message` is stored raw in the event log (and shown in the admin panel);
   * the Slack copy is `escapeSlackText(message)`, so interpolated user text
   * can't inject mentions or links. Pass `slackMessage` only when the Slack
   * copy needs intentional markup (mentions, `<url|label>` links) — it is
   * sent verbatim, so run any untrusted text interpolated into it through
   * `escapeSlackText` yourself.
   */
  async sendMessage(data: EventLogMessage): Promise<Result<void, Error>> {
    const { message } = data;

    const saved = await R.fromPromiseFn(() =>
      this.eventLogRepository.save(
        this.eventLogRepository.create(toEntity(data)),
      ),
    );
    if (R.isFailure(saved)) {
      this.logger.error(
        `Failed to record event log message: ${message}`,
        saved.error,
      );
      return saved;
    }

    await this.forwardBestEffort(saved.value, data);
    return R.success(undefined);
  }

  /**
   * Writes the entry through the caller's transaction, so it commits or rolls
   * back with the change it records. Use this when the entry is the only
   * remaining evidence of that change and so must not be able to go missing on
   * its own — an admin account deletion, where the row the entry describes no
   * longer exists to re-derive it from. Unlike {@link sendMessage} a failed
   * write rejects, so the caller's transaction aborts with it.
   *
   * Forwarding is deferred to the returned callback, which the caller runs
   * after committing: it makes a network call, which must not hold the
   * transaction open, and it must not announce a change that then rolled back.
   */
  async sendMessageInTransaction(
    manager: EntityManager,
    data: EventLogMessage,
  ): Promise<() => Promise<void>> {
    const saved = await manager.save(manager.create(EventLog, toEntity(data)));

    return () => this.forwardBestEffort(saved, data);
  }

  private async forwardBestEffort(
    saved: EventLog,
    data: EventLogMessage,
  ): Promise<void> {
    const forwarded = await R.fromPromiseFn(() => this.forward(saved, data));
    if (R.isFailure(forwarded)) {
      this.logger.error(
        `Failed to forward event log message: ${data.message}`,
        forwarded.error,
      );
    }
  }

  private async forward(saved: EventLog, data: EventLogMessage): Promise<void> {
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
      this.logger.warn("SLACK_WEBHOOK_URL is not set; skipping Slack message");
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      this.logger.log(`Skipping Slack message in development: ${slackMessage}`);
      return;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: slackMessage,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.logger.error(
          `Failed to send Slack message: ${res.status} ${res.statusText} ${text}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send Slack message: ${slackMessage}`, error);
    }
  }
}
