import { setEnv } from "@alliance/common/set-env";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EventLogService } from "src/eventlog/eventlog.service";
import type { MessageTrackingService } from "src/link-tracking/message-tracking.service";
import type { Repository } from "src/utils/Repository";
import type Twilio from "twilio";
import type { MmsNumberService } from "./mms-number.service";
import { Mms } from "./mms.entity";
import { MmsEvents } from "./mms.events";
import { MmsService } from "./mms.service";
import { TwilioStatusWorker } from "./twiliostatus.worker";

const TO = "+14155559101";

const twilioMessage = {
  sid: "SM0123456789",
  to: TO,
  from: "+15555550100",
  body: "Hi",
  status: "delivered",
  errorCode: null,
  errorMessage: null,
};

// The service and worker call only create and save on the repository, only
// messages.create and messages.get on the twilio client, and only optedOut on
// the number service.
const setup = () => {
  const eventEmitter = new EventEmitter2();
  const emit = jest.spyOn(eventEmitter, "emit");
  const mmsRepository = Object.assign({} as Repository<Mms>, {
    create: (row: Partial<Mms>) => row,
    save: (row: Partial<Mms>) =>
      Promise.resolve({ memberPhoneNumber: row.to, ...row, id: 7 }),
  });
  const service = new MmsService(
    mmsRepository,
    {} as EventLogService,
    {} as MessageTrackingService,
    Object.assign({} as MmsNumberService, { optedOut: async () => false }),
    eventEmitter,
  );
  service["twilioPhoneNumber"] = "+15555550100";
  service["twilioClient"] = Object.assign({} as Twilio.Twilio, {
    messages: {
      create: async () => ({ ...twilioMessage, status: "queued" }),
      get: () => ({ fetch: async () => twilioMessage }),
    },
  });
  const worker = new TwilioStatusWorker(
    service,
    mmsRepository,
    {} as EventLogService,
    eventEmitter,
  );
  const changes = () =>
    emit.mock.calls.filter(([event]) => event === MmsEvents.ThreadChanged);
  return { service, worker, changes };
};

it("marks an automated text as leaving Needs reply alone", async () => {
  const { service, changes } = setup();
  const previous = process.env.NODE_ENV;
  setEnv("NODE_ENV", "production");
  try {
    await service.sendMms({
      to: TO,
      userId: 1,
      body: "Hi",
      mediaUrls: [],
      tracking: null,
    });
  } finally {
    setEnv("NODE_ENV", previous);
  }
  expect(changes()).toEqual([
    [MmsEvents.ThreadChanged, { phoneNumber: TO, needsReplyChanged: false }],
  ]);
});

it("announces a staff text's status change, marking only one into or out of failure as moving Needs reply", async () => {
  const { worker, changes } = setup();
  const row = (status: string) =>
    Object.assign(new Mms(), {
      twilioSid: "SM0123456789",
      to: TO,
      memberPhoneNumber: TO,
      sentById: 3,
      status,
      errorCode: null,
    });

  await worker.refreshMmsData(row("delivered"));
  expect(changes()).toEqual([]);

  await worker.refreshMmsData(row("sent"));
  await worker.refreshMmsData(row("failed"));
  expect(changes()).toEqual([
    [MmsEvents.ThreadChanged, { phoneNumber: TO, needsReplyChanged: false }],
    [MmsEvents.ThreadChanged, { phoneNumber: TO, needsReplyChanged: true }],
  ]);
});

it("marks an automated text's status change as leaving Needs reply alone", async () => {
  const { worker, changes } = setup();

  await worker.refreshMmsData(
    Object.assign(new Mms(), {
      twilioSid: "SM0123456789",
      to: TO,
      memberPhoneNumber: TO,
      sentById: null,
      status: "sent",
      errorCode: null,
    }),
  );

  expect(changes()).toEqual([
    [MmsEvents.ThreadChanged, { phoneNumber: TO, needsReplyChanged: false }],
  ]);
});
