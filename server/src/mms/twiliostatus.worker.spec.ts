import type { EventLogService } from "src/eventlog/eventlog.service";
import type { MessageTrackingService } from "src/link-tracking/message-tracking.service";
import type { Repository } from "src/utils/Repository";
import { Mms } from "./mms.entity";
import { MmsService } from "./mms.service";
import { TwilioStatusWorker } from "./twiliostatus.worker";

describe("TwilioStatusWorker", () => {
  const queued = Object.assign(new Mms(), { id: 1, status: "queued" });
  const alsoQueued = Object.assign(new Mms(), { id: 2, status: "queued" });
  const previousEnv = { ...process.env };
  let refreshMmsData: jest.SpyInstance;
  let worker: TwilioStatusWorker;

  beforeEach(() => {
    // Safe: the worker only calls find, and the spied refreshMmsData never
    // reaches the service's own dependencies.
    const mmsRepository = {} as Repository<Mms>;
    mmsRepository.find = jest.fn(() => Promise.resolve([queued, alsoQueued]));
    const mmsService = new MmsService(
      {} as Repository<Mms>,
      {} as EventLogService,
      {} as MessageTrackingService,
    );
    refreshMmsData = jest
      .spyOn(mmsService, "refreshMmsData")
      .mockResolvedValue(queued);
    worker = new TwilioStatusWorker(mmsService, mmsRepository);
    process.env.SEND_DEV_NOTIFS = "0";
  });

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it("refreshes queued messages when delivery is on", async () => {
    process.env.NODE_ENV = "production";
    await worker.processTwilioStatus();
    expect(refreshMmsData).toHaveBeenCalledWith(queued);
  });

  it("keeps refreshing after one message fails", async () => {
    process.env.NODE_ENV = "production";
    refreshMmsData.mockRejectedValueOnce(new Error("not found"));
    await worker.processTwilioStatus();
    expect(refreshMmsData).toHaveBeenCalledWith(alsoQueued);
  });

  it("skips twilio when delivery is off", async () => {
    process.env.NODE_ENV = "development";
    await worker.processTwilioStatus();
    expect(refreshMmsData).not.toHaveBeenCalled();
  });
});
