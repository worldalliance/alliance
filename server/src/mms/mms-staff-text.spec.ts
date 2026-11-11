import { setEnv } from "@alliance/common/set-env";
import { Logger } from "@nestjs/common";
import { EventType } from "src/eventlog/event-log.entity";
import type { EventLogService } from "src/eventlog/eventlog.service";
import type { MessageTrackingService } from "src/link-tracking/message-tracking.service";
import type { Repository } from "src/utils/Repository";
import Twilio from "twilio";
import { type Mms, MmsDirection } from "./mms.entity";
import {
  MmsService,
  type SentMessage,
  StaffSendFailureKind,
} from "./mms.service";

const TO = "+14155559001";
const ADMIN_ID = 3;

describe("MmsService sendStaffText", () => {
  let saved: Partial<Mms>[];
  let mmsRepository: Repository<Mms>;
  let service: MmsService;
  let sendEvent: jest.Mock;
  let previousNodeEnv: string | undefined;

  const answerWith = (dispatch: () => Promise<SentMessage>) => {
    service["dispatch"] = dispatch;
  };
  const sendStaffText = () =>
    service.sendStaffText({
      to: TO,
      userId: 42,
      body: "Happy to help",
      sentById: ADMIN_ID,
    });

  beforeEach(() => {
    saved = [];
    // Safe: sendStaffText touches only the repository's create and save, the
    // event log's sendMessage, and nothing of the tracking service.
    mmsRepository = {} as Repository<Mms>;
    mmsRepository.create = jest
      .fn()
      .mockImplementation((row: Partial<Mms>) => row);
    mmsRepository.save = jest.fn().mockImplementation((row: Partial<Mms>) => {
      saved.push(row);
      return Promise.resolve({ ...row, id: 7 });
    });
    sendEvent = jest.fn();
    const eventLog = {} as EventLogService;
    eventLog.sendMessage = sendEvent;
    service = new MmsService(
      mmsRepository,
      eventLog,
      {} as MessageTrackingService,
    );
    service["twilioPhoneNumber"] = "+15555550100";
    previousNodeEnv = process.env.NODE_ENV;
    setEnv("NODE_ENV", "production");
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    setEnv("NODE_ENV", previousNodeEnv);
    jest.restoreAllMocks();
  });

  it("sends the staff member's text and records who sent it", async () => {
    const dispatch = jest.fn().mockResolvedValue({
      sid: "SM1",
      status: "queued",
      errorCode: null,
      errorMessage: null,
    });
    service["dispatch"] = dispatch;

    const result = await sendStaffText();

    expect(result.ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({
      to: TO,
      body: "Happy to help",
      mediaUrls: [],
    });
    expect(saved).toEqual([
      expect.objectContaining({
        direction: MmsDirection.Outbound,
        body: "Happy to help",
        sentById: ADMIN_ID,
        twilioSid: "SM1",
      }),
    ]);
  });

  it("dates the text from when its send began", async () => {
    let dispatchedAt = new Date(0);
    answerWith(async () => {
      dispatchedAt = new Date();
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        sid: "SM4",
        status: "queued",
        errorCode: null,
        errorMessage: null,
      };
    });

    await sendStaffText();

    expect(saved[0]?.createdAt?.getTime()).toBeLessThanOrEqual(
      dispatchedAt.getTime(),
    );
  });

  it("records the sender of a text it doesn't deliver", async () => {
    const dispatch = jest.fn();
    service["dispatch"] = dispatch;

    const result = await service.sendStaffText({
      to: "+15550000042",
      userId: 42,
      body: "Happy to help",
      sentById: ADMIN_ID,
    });

    expect(result.ok).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(saved).toEqual([
      expect.objectContaining({ sentById: ADMIN_ID, twilioSid: "test-sid" }),
    ]);
  });

  it("passes on Twilio's reason without the member's number, and alerts", async () => {
    answerWith(() =>
      Promise.reject(
        new Twilio.RestException({
          statusCode: 400,
          body: {
            code: 21211,
            message: `The 'To' number ${TO} is not a valid phone number.`,
          },
        }),
      ),
    );

    expect(await sendStaffText()).toEqual({
      ok: false,
      error: {
        kind: StaffSendFailureKind.Rejected,
        reason: "The 'To' number this number is not a valid phone number.",
      },
    });
    expect(saved).toEqual([]);
    expect(sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventType.SmsFailure }),
    );
  });

  it.each([
    [
      "an authentication failure",
      new Twilio.RestException({
        statusCode: 401,
        body: { code: 20003, message: "Authenticate" },
      }),
    ],
    ["a network error", new Error("getaddrinfo ENOTFOUND api.twilio.com")],
    [
      "a 400 with no message",
      new Twilio.RestException({ statusCode: 400, body: "{}" }),
    ],
    [
      "a 400 whose body isn't Twilio's JSON",
      new Twilio.RestException({
        statusCode: 400,
        body: "<html>Bad Request</html>",
      }),
    ],
  ])("gives no reason for %s, and alerts", async (_, error) => {
    answerWith(() => Promise.reject(error));

    expect(await sendStaffText()).toEqual({
      ok: false,
      error: { kind: StaffSendFailureKind.Failed },
    });
    expect(sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventType.SmsFailure }),
    );
  });

  it("logs and alerts on a timeout, then records the text if it lands", async () => {
    let land: (message: SentMessage) => void = () => {};
    answerWith(() => new Promise((resolve) => (land = resolve)));
    service["sendTimeoutMs"] = 5;

    expect(await sendStaffText()).toEqual({
      ok: false,
      error: { kind: StaffSendFailureKind.TimedOut },
    });
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining("timed out after 5ms"),
    );
    expect(sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventType.SmsFailure }),
    );
    const landedAt = Date.now();
    land({ sid: "SM2", status: "queued", errorCode: null, errorMessage: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(saved).toEqual([
      expect.objectContaining({ twilioSid: "SM2", sentById: ADMIN_ID }),
    ]);
    expect(saved[0]?.createdAt?.getTime()).toBeLessThan(landedAt);
  });

  it("logs the SID of a sent text it could not record", async () => {
    answerWith(() =>
      Promise.resolve({
        sid: "SM3",
        status: "queued",
        errorCode: null,
        errorMessage: null,
      }),
    );
    mmsRepository.save = jest.fn().mockRejectedValue(new Error("db down"));

    await expect(sendStaffText()).rejects.toThrow("db down");
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining("(SID SM3) but not recorded: db down"),
      expect.any(String),
    );
  });
});
