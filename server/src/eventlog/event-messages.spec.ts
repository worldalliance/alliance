import { setEnv } from "@alliance/common/set-env";
import { OptOutSource } from "src/mms/opt-out-source";
import { EventType } from "./event-log.entity";
import {
  type EventPayloads,
  renderEvent,
  SmsFailureKind,
} from "./event-messages";

const jane = { id: 5, name: "Jane Doe" };
const sam = { id: 6, name: "Sam Lee" };
const action = { id: 42, name: "Call your representative" };

const SAMPLES: { [T in EventType]: EventPayloads[T][] } = {
  [EventType.AccountCreated]: [
    { member: { ...jane, referredBy: sam } },
    { member: { ...jane, referredByCampaign: { name: "Spring drive" } } },
    { member: { ...jane, referredBy: null, referredByCampaign: null } },
  ],
  [EventType.ContractSigned]: [{ member: { ...jane, referredBy: sam } }],
  [EventType.ContractSuspended]: [
    { member: jane, automatic: true, missedSuites: 3 },
    { member: jane, automatic: false },
  ],
  [EventType.SmsUnsubscribe]: [
    {
      phoneNumber: "+15555550100",
      member: jane,
      source: { kind: OptOutSource.Keyword, rawBody: "Stop" },
    },
    {
      phoneNumber: "+15555550100",
      member: jane,
      source: { kind: OptOutSource.Staff, staff: sam },
    },
    {
      phoneNumber: "+15555550100",
      member: null,
      source: { kind: OptOutSource.Keyword, rawBody: "STOP" },
    },
  ],
  [EventType.SmsResubscribe]: [
    { phoneNumber: "+15555550100", member: jane, rawBody: "START" },
    { phoneNumber: "+15555550100", member: null, rawBody: "START" },
  ],
  [EventType.SmsInbound]: [
    {
      phoneNumber: "+15555550100",
      members: [jane],
      optedOut: false,
      body: "Who is this?",
    },
    {
      phoneNumber: "+15555550100",
      members: [jane],
      optedOut: true,
      body: "Who is this?",
    },
    {
      phoneNumber: "+15555550100",
      members: [],
      optedOut: true,
      body: "Who is this?",
    },
  ],
  [EventType.SmsFailure]: [
    {
      kind: SmsFailureKind.SendFailed,
      phoneNumber: "+15555550100",
      userId: jane.id,
      error: "timed out after 10000ms",
    },
    {
      kind: SmsFailureKind.DeliveryFailed,
      phoneNumber: "+15555550100",
      errorCode: 30003,
    },
    {
      kind: SmsFailureKind.OptInFailed,
      member: jane,
      phoneNumber: "+15555550100",
    },
    {
      kind: SmsFailureKind.SignatureRejected,
      webhookUrl: "https://api.example.org/mms/inbound",
      rejections: 1,
    },
    {
      kind: SmsFailureKind.SignatureRejected,
      webhookUrl: "https://api.example.org/mms/inbound",
      rejections: 4,
    },
  ],
  [EventType.ForumActionAutocomplete]: [{ member: jane, action }],
  [EventType.ActionComment]: [
    {
      author: jane,
      action,
      commentUrl: "https://app.example.org/actions/42#comment-7",
    },
  ],
  [EventType.ForumReplyNotifFailure]: [
    { recipient: jane, post: { id: 9, title: "Welcome thread" } },
  ],
  [EventType.ActionOptOut]: [
    {
      member: jane,
      action,
      option: "moral",
      recordedByAdmin: false,
      note: "Not for me",
    },
    {
      member: jane,
      action,
      option: "other",
      recordedByAdmin: true,
      note: null,
    },
  ],
  [EventType.AccountDeletionRequested]: [{ member: jane }],
  [EventType.AccountDeleted]: [
    {
      admin: sam,
      deleted: { name: "Jane Doe", email: "jane@example.com" },
      reason: "Duplicate account",
      screenshotUrl: "https://images.example.org/screenshot.png",
    },
    {
      admin: sam,
      deleted: { name: "Jane Doe", email: "jane@example.com" },
      reason: "Asked by email.",
      screenshotUrl: null,
    },
  ],
  [EventType.AdminRoleChanged]: [
    { actor: sam, target: jane, admin: true },
    { actor: sam, target: jane, admin: false },
  ],
  [EventType.WaitlistMailCapReached]: [{ dailyCap: 500 }],
  [EventType.PhoneNumberMoved]: [
    { phoneNumber: "+15555550100", previous: jane, verifiedBy: sam },
  ],
  [EventType.JoinRequest]: [],
};

function renderSamples<T extends EventType>(type: T) {
  return SAMPLES[type].map((payload) => ({
    type,
    ...renderEvent({ type, payload }),
  }));
}

describe("renderEvent", () => {
  const original = {
    ADMIN_URL: process.env.ADMIN_URL,
    APP_URL: process.env.APP_URL,
    ALT_APP_URL: process.env.ALT_APP_URL,
  };

  beforeEach(() => {
    setEnv("ADMIN_URL", "https://admin.example.org");
    setEnv("APP_URL", "https://app.example.org");
    setEnv("ALT_APP_URL", undefined);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) setEnv(key, value);
  });

  it("renders every event type", () => {
    const rendered = Object.values(EventType).flatMap(renderSamples);

    expect(rendered).toMatchSnapshot();
  });

  it("leaves names unlinked when the admin URL is unset", () => {
    setEnv("ADMIN_URL", undefined);

    expect(
      renderEvent({
        type: EventType.AccountDeletionRequested,
        payload: { member: jane },
      }).slack,
    ).toBe(
      "Jane Doe asked to delete their account. Delete it from their admin page.",
    );
  });

  it("drops a referrer without a name", () => {
    expect(
      renderEvent({
        type: EventType.ContractSigned,
        payload: { member: { ...jane, referredBy: { id: 6, name: "" } } },
      }).message,
    ).toBe("Jane Doe signed their contract.");
  });
});
