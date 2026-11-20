import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EventLogService } from "src/eventlog/eventlog.service";
import type { Repository } from "src/utils/Repository";
import { Mms } from "./mms.entity";
import type { MmsService } from "./mms.service";
import { TwilioStatusWorker } from "./twiliostatus.worker";

describe("TwilioStatusWorker", () => {
  const queued = Object.assign(new Mms(), { id: 1, status: "queued" });
  const alsoQueued = Object.assign(new Mms(), { id: 2, status: "queued" });
  const previousEnv = { ...process.env };
  let refreshMmsData: jest.SpyInstance;
  let worker: TwilioStatusWorker;

  beforeEach(() => {
    // Safe: the worker only calls find, and the spied refreshMmsData never
    // reaches the stubbed services.
    const mmsRepository = {} as Repository<Mms>;
    mmsRepository.find = jest.fn().mockResolvedValue([queued, alsoQueued]);
    worker = new TwilioStatusWorker(
      {} as MmsService,
      mmsRepository,
      {} as EventLogService,
      new EventEmitter2(),
    );
    refreshMmsData = jest
      .spyOn(worker, "refreshMmsData")
      .mockResolvedValue(queued);
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
