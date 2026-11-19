import {
  WITHDRAWAL_OPTION_LABELS,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { env } from "src/config/env";
import { OptOutSource } from "src/mms/opt-out-source";
import { postUrl, siteBaseUrl } from "src/search/approutes";
import { EventType } from "./event-log.entity";
import { escapeSlackText } from "./slack-format";

interface Link {
  label: string;
  url: string | null;
}
type Part = string | Link;
type EventText = Part[];

interface Named {
  id: number;
  name: string;
}
interface Referred extends Named {
  referredBy?: Named | null;
  referredByCampaign?: { name: string } | null;
}

export enum SmsFailureKind {
  SendFailed = "send_failed",
  StaffSendFailed = "staff_send_failed",
  DeliveryFailed = "delivery_failed",
  OptInFailed = "opt_in_failed",
  SignatureRejected = "signature_rejected",
}

export interface EventPayloads {
  [EventType.AccountCreated]: { member: Referred };
  [EventType.ContractSigned]: { member: Referred };
  [EventType.ContractSuspended]:
    | { member: Referred; automatic: false }
    | { member: Referred; automatic: true; missedSuites: number };
  [EventType.SmsUnsubscribe]: {
    phoneNumber: string;
    member: Named | null;
    source:
      | { kind: OptOutSource.Keyword; rawBody: string }
      | { kind: OptOutSource.Staff; staff: Named };
  };
  [EventType.SmsResubscribe]: {
    phoneNumber: string;
    member: Named | null;
    rawBody: string;
  };
  [EventType.SmsInbound]: {
    phoneNumber: string;
    members: Named[];
    /** Every member on the number has opted out, so Needs reply omits them. */
    optedOut: boolean;
    body: string;
  };
  [EventType.SmsFailure]:
    | {
        kind: SmsFailureKind.SendFailed;
        phoneNumber: string;
        userId: number;
        error: string;
      }
    | {
        kind: SmsFailureKind.StaffSendFailed;
        phoneNumber: string;
        threadId: string;
        error: string;
      }
    | {
        kind: SmsFailureKind.DeliveryFailed;
        phoneNumber: string;
        errorCode: number;
      }
    | { kind: SmsFailureKind.OptInFailed; member: Named; phoneNumber: string }
    | {
        kind: SmsFailureKind.SignatureRejected;
        webhookUrl: string;
        rejections: number;
      };
  [EventType.ForumActionAutocomplete]: { member: Named; action: Named };
  [EventType.ActionComment]: {
    author: Named;
    action: Named;
    commentUrl: string;
  };
  [EventType.ForumReplyNotifFailure]: {
    recipient: Named;
    post: { id: number; title: string };
  };
  [EventType.ActionOptOut]: {
    member: Named;
    action: Named;
    option: WithdrawalOption;
    recordedByAdmin: boolean;
    note: string | null;
  };
  [EventType.AccountDeletionRequested]: { member: Named };
  [EventType.AccountDeleted]: {
    admin: Named;
    deleted: { name: string; email: string };
    reason: string;
    screenshotUrl: string | null;
  };
  [EventType.AdminRoleChanged]: {
    actor: Named;
    target: Named;
    admin: boolean;
  };
  [EventType.WaitlistMailCapReached]: { dailyCap: number };
  [EventType.PhoneNumberMoved]: {
    phoneNumber: string;
    previous: Named;
    verifiedBy: Named;
  };
  [EventType.JoinRequest]: never;
}

export type EventMessage = {
  [T in EventType]: { type: T; payload: EventPayloads[T] };
}[EventType];

function text(
  strings: TemplateStringsArray,
  ...values: (Part | EventText)[]
): EventText {
  return strings.flatMap((s, i) =>
    i < values.length ? [s, ...[values[i]].flat()] : [s],
  );
}

function join(parts: Part[], separator: string): EventText {
  return parts.flatMap((part, i) => (i === 0 ? [part] : [separator, part]));
}

function adminLink(label: string, path: string): Link {
  const base = env("ADMIN_URL");
  return { label, url: base ? `${base}${path}` : null };
}

const member = (user: Named) => adminLink(user.name, `/member/${user.id}`);
const action = (a: Named) => adminLink(a.name, `/actions/${a.id}`);

function referred(user: Referred): EventText {
  if (user.referredBy?.name) {
    return text`${member(user)} (invited by ${member(user.referredBy)})`;
  }
  if (user.referredByCampaign?.name) {
    return text`${member(user)} (via the ${user.referredByCampaign.name} campaign)`;
  }
  return [member(user)];
}

function smsFailure(payload: EventPayloads[EventType.SmsFailure]): EventText {
  switch (payload.kind) {
    case SmsFailureKind.SendFailed:
      return text`Couldn't send a text to ${adminLink(payload.phoneNumber, `/member/${payload.userId}`)}: ${payload.error}`;
    case SmsFailureKind.StaffSendFailed:
      return text`Couldn't send a staff text to ${adminLink(payload.phoneNumber, `/texts/${payload.threadId}`)}: ${payload.error}`;
    case SmsFailureKind.DeliveryFailed:
      return text`Twilio reported error ${{ label: String(payload.errorCode), url: `https://www.twilio.com/docs/api/errors/${payload.errorCode}` }} for a text to ${payload.phoneNumber}.`;
    case SmsFailureKind.OptInFailed:
      return text`Couldn't send the texting opt-in message to ${member(payload.member)} at ${payload.phoneNumber}.`;
    case SmsFailureKind.SignatureRejected: {
      const since =
        payload.rejections === 1
          ? ""
          : ` (${payload.rejections} rejections since the last alert)`;
      return text`Twilio's inbound webhook is being rejected: its signature didn't match${since}. Members' STOP and START replies aren't being honoured until this is fixed. Check that the webhook URL in the Twilio console is exactly ${payload.webhookUrl}.`;
    }
    default:
      throw new Error(`unknown SMS failure: ${payload satisfies never}`);
  }
}

const FORMATS: {
  [T in EventType]: (payload: EventPayloads[T]) => EventText;
} = {
  [EventType.AccountCreated]: (p) =>
    text`${referred(p.member)} created an account.`,
  [EventType.ContractSigned]: (p) =>
    text`${referred(p.member)} signed their contract.`,
  [EventType.ContractSuspended]: (p) =>
    p.automatic
      ? text`Contract suspended automatically for ${referred(p.member)}: they missed ${String(p.missedSuites)} action suites in a row.`
      : text`${referred(p.member)} suspended their contract.`,
  [EventType.SmsUnsubscribe]: ({ phoneNumber, member: m, source }) => {
    switch (source.kind) {
      case OptOutSource.Keyword:
        return m
          ? text`${member(m)} opted out of texts by replying “${source.rawBody}”.`
          : text`${phoneNumber} opted out of texts, but no member has that number.`;
      case OptOutSource.Staff:
        return m
          ? text`${member(source.staff)} marked ${member(m)} as opted out of texts.`
          : text`${member(source.staff)} marked ${phoneNumber} as opted out of texts. No member has that number.`;
      default:
        throw new Error(`unknown opt-out source: ${source satisfies never}`);
    }
  },
  [EventType.SmsResubscribe]: ({ phoneNumber, member: m, rawBody }) =>
    m
      ? text`${member(m)} opted back in to texts by replying “${rawBody}”.`
      : text`${phoneNumber} replied “${rawBody}” to opt back in to texts, but no member has that number.`,
  [EventType.SmsInbound]: ({ phoneNumber, members, optedOut, body }) => {
    if (members.length === 0) {
      return text`${phoneNumber}, which no member has, texted: “${body}”`;
    }
    const texted = text`${join(members.map(member), ", ")} texted: “${body}”`;
    return optedOut
      ? text`${texted} They have opted out of texts.`
      : text`${texted} Reply from ${adminLink("Needs reply", "/needs-reply")}.`;
  },
  [EventType.SmsFailure]: smsFailure,
  [EventType.ForumActionAutocomplete]: (p) =>
    text`${member(p.member)} completed ${action(p.action)} automatically by replying in its forum.`,
  [EventType.ActionComment]: (p) =>
    text`${member(p.author)} commented on ${{ label: p.action.name, url: p.commentUrl }}.`,
  [EventType.ForumReplyNotifFailure]: (p) =>
    text`${member(p.recipient)} wasn't told about a reply on ${{ label: p.post.title, url: `${siteBaseUrl() ?? ""}${postUrl(p.post.id)}` }}: they have text and email notifications off.`,
  [EventType.ActionOptOut]: (p) => {
    const note = p.note ? ` — “${p.note}”` : "";
    return p.recordedByAdmin
      ? text`An admin recorded that ${member(p.member)} opted out of ${action(p.action)}${note}.`
      : text`${member(p.member)} opted out of ${action(p.action)}: ${WITHDRAWAL_OPTION_LABELS[p.option]}${note}.`;
  },
  [EventType.AccountDeletionRequested]: (p) =>
    text`${member(p.member)} asked to delete their account. Delete it from their admin page.`,
  [EventType.AccountDeleted]: (p) => [
    ...text`${member(p.admin)} deleted ${p.deleted.name}'s account (${p.deleted.email}). Reason: “${p.reason}”`,
    ...(p.screenshotUrl
      ? text` — screenshot: ${{ label: p.screenshotUrl, url: p.screenshotUrl }}`
      : []),
  ],
  [EventType.AdminRoleChanged]: (p) =>
    p.admin
      ? text`${member(p.actor)} granted admin to ${member(p.target)}.`
      : text`${member(p.actor)} revoked admin from ${member(p.target)}.`,
  [EventType.WaitlistMailCapReached]: (p) =>
    text`Waitlist emails hit their daily cap of ${String(p.dailyCap)}. Confirmation and link emails are paused until 00:00 UTC; raise WAITLIST_PUBLIC_MAIL_DAILY_CAP to send more.`,
  [EventType.PhoneNumberMoved]: (p) =>
    text`${member(p.verifiedBy)} verified ${p.phoneNumber}, so it was taken off ${member(p.previous)}'s account.`,
  [EventType.JoinRequest]: (payload) => payload,
};

/** `message` is the admin event-log text; `slack` is the same line with
 * links, escaped for Slack. */
export function renderEvent<T extends EventType>(event: {
  type: T;
  payload: EventPayloads[T];
}): { message: string; slack: string } {
  const parts = FORMATS[event.type](event.payload);
  return {
    message: parts
      .map((part) => (typeof part === "string" ? part : part.label))
      .join(""),
    slack: parts
      .map((part) => {
        if (typeof part === "string") return escapeSlackText(part);
        const label = escapeSlackText(part.label);
        return part.url ? `<${part.url}|${label}>` : label;
      })
      .join(""),
  };
}
