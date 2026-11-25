import { setEnv } from "@alliance/common/set-env";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Repository } from "src/utils/Repository";
import { EventLog, EventType } from "./event-log.entity";
import { EventLogEvents } from "./eventlog.events";
import { EventLogService } from "./eventlog.service";

describe("EventLogService.sendMessage", () => {
  let service: EventLogService;
  // `findOne` is generic over the requested relations, so its mocked signature
  // would demand a fully loaded row; widen just that one to a bare mock.
  let repository: jest.Mocked<Repository<EventLog>> & { findOne: jest.Mock };
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let fetchMock: jest.Mock;

  const savedRow = { id: "event-log-1" } as EventLog;
  const signed = {
    type: EventType.ContractSigned,
    payload: { member: { id: 5, name: "Jane" } },
  } as const;
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    ADMIN_URL: process.env.ADMIN_URL,
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
    } as unknown as jest.Mocked<Repository<EventLog>> & { findOne: jest.Mock };

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    service = new EventLogService(repository, eventEmitter);
    jest.spyOn(service["logger"], "error").mockImplementation(() => {});
    jest.spyOn(service["logger"], "log").mockImplementation(() => {});
    jest.spyOn(service["logger"], "warn").mockImplementation(() => {});

    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.NODE_ENV = "production";
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.example/services/T00";
    process.env.ADMIN_URL = "https://admin.example.org";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setEnv("NODE_ENV", originalEnv.NODE_ENV);
    setEnv("SLACK_WEBHOOK_URL", originalEnv.SLACK_WEBHOOK_URL);
    setEnv("ADMIN_URL", originalEnv.ADMIN_URL);
  });

  it("returns failure and does not forward when the event-log write fails", async () => {
    const dbError = new Error("connection lost");
    repository.save.mockRejectedValue(dbError);

    const result = await service.sendMessage({
      ...signed,
      blob: null,
      userId: null,
    });

    expect(result).toEqual({ ok: false, error: dbError });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns success when the write succeeds but forwarding fails", async () => {
    repository.findOne.mockRejectedValue(new Error("re-query failed"));

    const result = await service.sendMessage({
      ...signed,
      blob: null,
      userId: null,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(service["logger"].error).toHaveBeenCalled();
  });

  it("stores nullable fields as null", async () => {
    await service.sendMessage({
      ...signed,
      blob: null,
      userId: null,
    });

    expect(repository.create).toHaveBeenCalledWith({
      event: EventType.ContractSigned,
      message: "Jane signed their contract.",
      blob: null,
      userId: null,
    });
  });

  it("stores plain text and posts the Slack copy with links and escaping", async () => {
    const result = await service.sendMessage({
      type: EventType.ActionOptOut,
      payload: {
        member: { id: 5, name: "Jane <!channel>" },
        action: { id: 42, name: "Call & write" },
        option: "other",
        recordedByAdmin: false,
        note: "<https://evil.example|click>",
      },
      blob: null,
      userId: null,
    });

    expect(result.ok).toBe(true);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Jane <!channel> opted out of Call & write: Other reason — “<https://evil.example|click>”.",
      }),
    );
    expect(postedSlackText()).toBe(
      "<https://admin.example.org/member/5|Jane &lt;!channel&gt;> opted out of <https://admin.example.org/actions/42|Call &amp; write>: Other reason — “&lt;https://evil.example|click&gt;”.",
    );
  });

  it("does not post to Slack for types excluded from SEND_TO_SLACK", async () => {
    const result = await service.sendMessage({
      type: EventType.ForumReplyNotifFailure,
      payload: {
        recipient: { id: 5, name: "Jane" },
        post: { id: 9, title: "Welcome" },
      },
      blob: null,
      userId: null,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the Slack post outside production", async () => {
    process.env.NODE_ENV = "development";

    const result = await service.sendMessage({
      ...signed,
      blob: null,
      userId: null,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emits the created event with the re-queried row", async () => {
    const fullEvent = {
      id: savedRow.id,
      event: EventType.ContractSigned,
      message: "Jane signed their contract.",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      userId: 5,
      user: { id: 5, anonymous: false, name: "Jane" },
    } as EventLog;
    repository.findOne.mockResolvedValue(fullEvent);

    await service.sendMessage({
      ...signed,
      userId: 5,
      blob: null,
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventLogEvents.Created,
      expect.objectContaining({ id: savedRow.id, userId: 5 }),
    );
  });
});
