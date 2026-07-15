import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Repository } from 'typeorm';
import { EventLog, EventType } from './event-log.entity';
import { EventLogEvents } from './eventlog.events';
import { EventLogService } from './eventlog.service';
import { escapeSlackText } from './slack-format';

describe('EventLogService.sendMessage', () => {
  let service: EventLogService;
  let repository: jest.Mocked<Repository<EventLog>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let fetchMock: jest.Mock;

  const savedRow = { id: 'event-log-1' } as EventLog;
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  };
  const originalFetch = globalThis.fetch;

  /** The Slack `text` posted by the last webhook call. */
  const postedSlackText = (): string => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    return (JSON.parse(init.body) as { text: string }).text;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn().mockImplementation((entity) => entity as EventLog),
      save: jest.fn().mockResolvedValue(savedRow),
      // null skips the created-event emit; tests that need it override this.
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<Repository<EventLog>>;

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    service = new EventLogService(repository, eventEmitter);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});

    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.NODE_ENV = 'production';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.example/services/T00';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.SLACK_WEBHOOK_URL = originalEnv.SLACK_WEBHOOK_URL;
  });

  it('returns failure and does not forward when the event-log write fails', async () => {
    const dbError = new Error('connection lost');
    repository.save.mockRejectedValue(dbError);

    const result = await service.sendMessage({
      type: EventType.ContractSigned,
      message: 'Jane signed their contract',
    });

    expect(result).toEqual({ ok: false, error: dbError });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns success when the write succeeds but forwarding fails', async () => {
    repository.findOne.mockRejectedValue(new Error('re-query failed'));

    const result = await service.sendMessage({
      type: EventType.ContractSigned,
      message: 'Jane signed their contract',
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(service['logger'].error).toHaveBeenCalled();
  });

  it('stores the raw message and escapes the Slack copy by default', async () => {
    const message = 'Jane <!channel> & <https://evil.example|click> opted out';

    const result = await service.sendMessage({
      type: EventType.ActionOptOut,
      message,
    });

    expect(result.ok).toBe(true);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ message }),
    );
    expect(postedSlackText()).toBe(escapeSlackText(message));
  });

  it('sends slackMessage verbatim when provided', async () => {
    const slackMessage = 'New comment <@U123> - <https://app.example|Open>';

    await service.sendMessage({
      type: EventType.ActionComment,
      message: 'New comment on action 42',
      slackMessage,
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'New comment on action 42' }),
    );
    expect(postedSlackText()).toBe(slackMessage);
  });

  it('does not post to Slack for types excluded from SEND_TO_SLACK', async () => {
    const result = await service.sendMessage({
      type: EventType.ForumReplyNotifFailure,
      message: 'notif failure',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the Slack post outside production', async () => {
    process.env.NODE_ENV = 'development';

    const result = await service.sendMessage({
      type: EventType.ContractSigned,
      message: 'Jane signed their contract',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits the created event with the re-queried row', async () => {
    const fullEvent = {
      id: savedRow.id,
      event: EventType.ContractSigned,
      message: 'Jane signed their contract',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      userId: 5,
      user: { id: 5, anonymous: false, name: 'Jane' },
    } as EventLog;
    repository.findOne.mockResolvedValue(fullEvent);

    await service.sendMessage({
      type: EventType.ContractSigned,
      message: 'Jane signed their contract',
      userId: 5,
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventLogEvents.Created,
      expect.objectContaining({ id: savedRow.id, userId: 5 }),
    );
  });
});
