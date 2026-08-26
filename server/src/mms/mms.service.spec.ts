import { Logger } from "@nestjs/common";
import { EventType } from "src/eventlog/event-log.entity";
import type { EventLogService } from "src/eventlog/eventlog.service";
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
    service = new MmsService(mmsRepository, eventLogService);
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
        cid: "cid-1",
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
        cid: "cid-1",
      },
    ]);
    expect(eventLogService.sendMessage).not.toHaveBeenCalled();
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
        cid: "cid-1",
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
    service["recordLateSend"]({
      sending: Promise.reject(new Error("network down")),
      to: TO,
      body: BODY,
      cid: "cid-1",
    });
    await delay(0);

    expect(saved).toEqual([]);
    // This test staying green also covers the rejection: bun fails a test that
    // leaves one unhandled, and sendMms has stopped listening by this point.
  });
});
