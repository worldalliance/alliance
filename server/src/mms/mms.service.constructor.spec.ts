import { setEnv } from "@alliance/common/set-env";
import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EventLogService } from "src/eventlog/eventlog.service";
import type { MessageTrackingService } from "src/link-tracking/message-tracking.service";
import type { Repository } from "src/utils/Repository";
import type { MmsNumberService } from "./mms-number.service";
import type { Mms } from "./mms.entity";
import { MmsService } from "./mms.service";

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
      {} as MmsNumberService,
      new EventEmitter2(),
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
      setEnv(key, value);
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
});
