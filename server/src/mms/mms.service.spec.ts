import { Logger } from "@nestjs/common";
import { EventType } from "src/eventlog/event-log.entity";
import type { EventLogService } from "src/eventlog/eventlog.service";
import {
  MessageSource,
  type MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { MessageTrackingService } from "src/link-tracking/message-tracking.service";
import type { Repository } from "src/utils/Repository";
import type Twilio from "twilio";
import type { Mms } from "./mms.entity";
import { MmsService } from "./mms.service";

const TO = "+14155559001";
const BODY = "you have tasks waiting";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const message = {
  sid: "SM0123456789",
  status: "queued" as const,
  errorCode: null,
  errorMessage: null,
};

// sendMms reads NODE_ENV on the way in, and again in the catch that reports the
// failure, so it has to say production for the whole call.
const asProduction = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    return await run();
  } finally {
    process.env.NODE_ENV = previous;
  }
};

describe("MmsService sendMms", () => {
  let saved: Partial<Mms>[];
  let eventLogService: jest.Mocked<EventLogService>;
  let service: MmsService;
  let messageTracking: MessageTrackingService;

  beforeEach(() => {
    saved = [];
    const mmsRepository = {
      create: jest.fn((row: Partial<Mms>) => row),
      save: jest.fn((row: Partial<Mms>) => {
        saved.push(row);
        return Promise.resolve({ ...row, id: 7 });
      }),
    } as unknown as jest.Mocked<Repository<Mms>>;
    eventLogService = {
      sendMessage: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

    // bun sets NODE_ENV=test, so the constructor returns before it reaches
    // twilio and leaves the client and the sender unset.
    messageTracking = new MessageTrackingService(
      {} as Repository<MessageTracking>,
    );
    jest.spyOn(messageTracking, "track").mockResolvedValue("track-1");
    service = new MmsService(mmsRepository, eventLogService, messageTracking);
    service["twilioPhoneNumber"] = "+15555550100";

    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("saves the row for a send twilio answers in time", async () => {
    service["twilioClient"] = {
      messages: { create: () => Promise.resolve(message) },
    } as unknown as Twilio.Twilio;

    const result = await asProduction(() =>
      service.sendMms({
        to: TO,
        body: BODY,
        mediaUrls: ["https://example.com/task.png"],
        tracking: null,
      }),
    );

    expect(result).toEqual(expect.objectContaining({ id: 7 }));
    expect(saved).toEqual([
      {
        to: TO,
        from: "+15555550100",
        body: BODY,
        twilioSid: "SM0123456789",
        status: "queued",
        errorCode: null,
        errorMessage: null,
        cid: null,
      },
    ]);
    expect(eventLogService.sendMessage).not.toHaveBeenCalled();
  });

  it("tags app links with the message's own tracking ID", async () => {
    const appUrl = process.env.APP_URL;
    process.env.APP_URL = "https://app.example.org";
    try {
      await service.sendMms({
        to: TO,
        body: "Tasks: https://app.example.org/tasks",
        mediaUrls: [],
        tracking: {
          owner: { userId: 1 },
          source: MessageSource.ForumReply,
          context: {},
          actionEventNotifId: null,
        },
      });
    } finally {
      process.env.APP_URL = appUrl;
    }

    expect(saved).toEqual([
      expect.objectContaining({
        body: "Tasks: https://app.example.org/tasks?cid=track-1",
        cid: "track-1",
      }),
    ]);
  });

  it("reports a failed tracking insert as an unsent text", async () => {
    jest
      .spyOn(messageTracking, "track")
      .mockRejectedValue(new Error("insert failed"));

    const result = await asProduction(() =>
      service.sendMms({
        to: TO,
        body: BODY,
        mediaUrls: [],
        tracking: {
          owner: { userId: 1 },
          source: MessageSource.ForumReply,
          context: {},
          actionEventNotifId: null,
        },
      }),
    );

    expect(result).toBeNull();
    expect(saved).toEqual([]);
    expect(eventLogService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventType.SmsFailure }),
    );
  });

  it.each([
    { twilio: "rejects", result: false },
    { twilio: "accepts", result: true },
  ])("keeps the tracking only when twilio $twilio", async ({ result }) => {
    const discard = jest
      .spyOn(messageTracking, "discard")
      .mockResolvedValue(undefined);
    service["twilioClient"] = {
      messages: {
        create: () =>
          result
            ? Promise.resolve(message)
            : Promise.reject(new Error("21610 unsubscribed recipient")),
      },
    } as unknown as Twilio.Twilio;

    await asProduction(() =>
      service.sendMms({
        to: TO,
        body: BODY,
        mediaUrls: [],
        tracking: {
          owner: { userId: 1 },
          source: MessageSource.ForumReply,
          context: {},
          actionEventNotifId: null,
        },
      }),
    );

    expect(discard.mock.calls).toEqual(result ? [] : [["track-1"]]);
  });

  it("sends to UK numbers from the alphanumeric sender", async () => {
    const create = jest.fn(() => Promise.resolve(message));
    service["twilioClient"] = {
      messages: { create },
    } as unknown as Twilio.Twilio;

    await asProduction(() =>
      service.sendMms({
        to: "+447700900123",
        body: BODY,
        mediaUrls: [],
        tracking: null,
      }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+447700900123", from: "The Alliance" }),
    );
    expect(saved).toEqual([expect.objectContaining({ from: "The Alliance" })]);
  });

  it("gives up on a send twilio never answers", async () => {
    service["twilioClient"] = {
      messages: { create: () => new Promise(() => {}) },
    } as unknown as Twilio.Twilio;
    service["sendTimeoutMs"] = 5;

    const result = await asProduction(() =>
      service.sendMms({
        to: TO,
        body: BODY,
        mediaUrls: ["https://example.com/task.png"],
        tracking: null,
      }),
    );

    expect(result).toBeNull();
    expect(saved).toEqual([]);
    expect(eventLogService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventType.SmsFailure,
        message: `Failed to send MMS to ${TO}: sendMms timed out after 5ms`,
      }),
    );
  });

  // The deadline is covered above. These two drive recordLateSend on its own,
  // since what they turn on is the row it writes once sendMms has already
  // answered and stopped listening.
  it("records a send that twilio accepted after the deadline", async () => {
    service["recordLateSend"]({
      sending: Promise.resolve(message),
      to: TO,
      body: BODY,
      cid: "cid-1",
    });
    await delay(0);

    expect(saved).toEqual([
      {
        to: TO,
        from: "+15555550100",
        body: BODY,
        twilioSid: "SM0123456789",
        status: "queued",
        errorCode: null,
        errorMessage: null,
        cid: "cid-1",
      },
    ]);
  });

  it("writes no row for a send that failed after the deadline", async () => {
    const discard = jest
      .spyOn(messageTracking, "discard")
      .mockResolvedValue(undefined);
    service["recordLateSend"]({
      sending: Promise.reject(new Error("network down")),
      to: TO,
      body: BODY,
      cid: "cid-1",
    });
    await delay(0);

    expect(saved).toEqual([]);
    expect(discard).toHaveBeenCalledWith("cid-1");
    // This test staying green also covers the rejection: bun fails a test that
    // leaves one unhandled, and sendMms has stopped listening by this point.
  });
});

describe("MmsService constructor", () => {
  const ENV_KEYS = [
    "NODE_ENV",
    "SEND_DEV_NOTIFS",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ];
  let previous: Record<string, string | undefined>;

  // The constructor only stores these.
  const construct = () =>
    new MmsService(
      {} as Repository<Mms>,
      {} as EventLogService,
      {} as MessageTrackingService,
    );

  beforeEach(() => {
    previous = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.NODE_ENV = "development";
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.restoreAllMocks();
  });

  it("boots without twilio config when SEND_DEV_NOTIFS is unset", () => {
    expect(construct).not.toThrow();
  });

  it("boots without twilio config when SEND_DEV_NOTIFS=0", () => {
    process.env.SEND_DEV_NOTIFS = "0";
    expect(construct).not.toThrow();
  });

  it("refuses to boot without twilio config when texts go out", () => {
    process.env.SEND_DEV_NOTIFS = "1";
    expect(construct).toThrow("Twilio configuration is missing or invalid.");
  });

  it("refuses to boot without twilio config in production", () => {
    process.env.NODE_ENV = "production";
    expect(construct).toThrow("Twilio configuration is missing or invalid.");
  });
});
