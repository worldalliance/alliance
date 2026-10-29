import { thrownMessage, thrownStack } from "@alliance/common/errorMessage";
import { nameParts } from "@alliance/common/nameParts";
import { R, type Result } from "@alliance/common/result";
import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import { ISendMailOptions, MailerService } from "@nestjs-modules/mailer";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import {
  MessageChannel,
  MessageSource,
} from "src/link-tracking/message-tracking.entity";
import {
  MessageTrackingService,
  type TrackedMessage,
} from "src/link-tracking/message-tracking.service";
import { tagHtmlLinks } from "src/link-tracking/tag-links";
import { reinstatementMessage } from "src/notifs/textnotifcontents";
import {
  membershipUrl,
  passwordResetUrl,
  tasksUrl,
  verifyEmailUrl,
} from "src/search/approutes";
import {
  DeliveryFailure,
  notifDeliveryEnabled,
} from "src/utils/notif-delivery";
import type { Repository } from "src/utils/Repository";
import { ContractReminderCopy } from "./contract-reminder-copy";
import { EmailStatus, EmailType, Mail } from "./mail.entity";

const SEND_TIMEOUT_MS = milliseconds({ seconds: 10 });

export function mailSendingEnabled(): boolean {
  return process.env.NODE_ENV !== "test" && notifDeliveryEnabled();
}

/**
 * `scripts/anonymize/anonymize.sql` writes these in place of real addresses.
 * example.com accepts no mail, so sending would only bounce.
 */
function isAnonymizedEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@example.com");
}

export type WaitlistEmailType =
  | EmailType.WaitlistConfirmation
  | EmailType.WaitlistLink;

/** `bodyHtml` must be safe to embed, as `renderWaitlistEmail` produces. */
export type WaitlistStaffEmail = {
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
};

const WAITLIST_SUBJECTS: Record<WaitlistEmailType, string> = {
  [EmailType.WaitlistConfirmation]: "You’re on the Alliance waitlist",
  [EmailType.WaitlistLink]: "Your Alliance waitlist link",
};

const CONTRACT_REMINDER_CONTENT: Record<
  ContractReminderCopy,
  { subject: string; link: () => string }
> = {
  [ContractReminderCopy.Control]: {
    subject: "Sign your membership contract to participate in actions",
    link: () => tasksUrl(true),
  },
  [ContractReminderCopy.AgreementV1]: {
    subject: "The last step is entering into the membership agreement.",
    link: () => membershipUrl(true),
  },
};

/** Thrown by `sendMail` when it failed before handing the message to the mail server. */
export class MailNotSentError extends Error {}

const notSent = (error: unknown): never => {
  throw new MailNotSentError(
    error instanceof Error ? error.message : String(error),
    { cause: error },
  );
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private sendTimeoutMs = SEND_TIMEOUT_MS;

  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(Mail)
    private readonly mailRepository: Repository<Mail>,
    private readonly messageTracking: MessageTrackingService,
  ) {}

  private readonly templates: Record<EmailType, string> = {
    [EmailType.Welcome]: "welcome",
    [EmailType.PasswordReset]: "password-reset",
    [EmailType.Verification]: "",
    [EmailType.Other]: "",
    [EmailType.Commitment]: "commitment",
    [EmailType.MemberAction]: "memberaction",
    [EmailType.CommitmentReminder]: "commitmentreminder",
    [EmailType.MemberActionReminder]: "memberactionreminder",
    [EmailType.ForumDigest]: "",
    [EmailType.ForumReply]: "forumreply",
    [EmailType.MissedDeadline]: "misseddeadline",
    [EmailType.MissedSecondDeadline]: "missedseconddeadline",
    [EmailType.CustomActionReminder]: "customactionreminder",
    [EmailType.ContractSuspended]: "contractsuspended",
    [EmailType.ContractReinstated]: "contractreinstated",
    [EmailType.ContractReminder]: "contractreminder",
    [EmailType.WaitlistConfirmation]: "waitlist-confirmation",
    [EmailType.WaitlistLink]: "waitlist-link",
    [EmailType.WaitlistStaff]: "waitlist-staff",
    [EmailType.OtpCode]: "otp-code",
  };

  async renderHtml(emailType: EmailType, context: ISendMailOptions["context"]) {
    const pug = await import("pug");

    return pug.renderFile(
      __dirname + `/templates/${this.templates[emailType]}.pug`,
      { ...context },
    );
  }

  private async prepareSend(
    emailType: EmailType,
    context: ISendMailOptions["context"],
  ): Promise<{ from: string; rendered: string }> {
    // Apple forwards to a Hide My Email relay only from senders registered
    // under Sign in with Apple for Email Communication in the developer
    // portal. Register a new address there before changing MAIL_FROM.
    const from = process.env.MAIL_FROM;
    if (!from) {
      throw new MailNotSentError("MAIL_FROM is unset");
    }
    const rendered = await this.renderHtml(emailType, context).catch(notSent);
    return { from, rendered };
  }

  async sendMail(params: {
    recipient: string;
    emailType: EmailType;
    subject: string | null;
    context: ISendMailOptions["context"];
    tracking: TrackedMessage | null;
  }): Promise<Mail> {
    const { recipient, emailType, subject, context, tracking } = params;
    const prepared =
      mailSendingEnabled() && !isAnonymizedEmail(recipient)
        ? await this.prepareSend(emailType, context)
        : null;
    const cid =
      tracking &&
      (await this.messageTracking
        .track({ message: tracking, channel: MessageChannel.Email })
        .catch(notSent));
    const mail = this.mailRepository.create({
      sentMessageId: null,
      renderedHtml: null,
      to: recipient,
      emailType: emailType,
      status: EmailStatus.Pending,
      cid,
    });

    if (!prepared) {
      return await this.mailRepository.save(mail);
    }
    const { from, rendered } = prepared;

    const html = cid
      ? tagHtmlLinks({ html: rendered, trackingId: cid })
      : rendered;

    mail.renderedHtml = html;
    await this.mailRepository.save(mail).catch(async (error: unknown) => {
      if (cid) await this.messageTracking.discard(cid);
      return notSent(error);
    });

    const sent = await R.fromPromise(
      this.transmit({
        recipient,
        from,
        emailType,
        subject,
        html,
        providerTracking: true,
      }),
    );

    if (!sent.ok) {
      mail.status = EmailStatus.Failed;
      await this.mailRepository.save(mail);
      throw sent.error;
    }

    const { accepted, messageId } = sent.value;

    if (accepted.length > 0) {
      mail.status = EmailStatus.Sent;
    } else {
      mail.status = EmailStatus.Failed;
    }
    mail.sentMessageId = messageId;
    return this.mailRepository.save(mail);
  }

  private transmit(params: {
    recipient: string;
    from: string;
    emailType: EmailType;
    subject: string | null;
    html: string;
    providerTracking: boolean;
  }): Promise<SMTPTransport.SentMessageInfo> {
    const { recipient, from, emailType, subject, html, providerTracking } =
      params;
    return this.mailerService.sendMail({
      to: recipient,
      from,
      subject: subject ?? undefined,
      headers: {
        "o:tag": emailType,
        "X-Mailgun-Tag":
          process.env.NODE_ENV === "production" ? "production" : "development",
        ...(providerTracking ? {} : { "X-Mailgun-Track": "no" }),
      },
      html,
    });
  }

  /**
   * Sends with no Mail row and no link tracking, ours or Mailgun's, so we keep
   * no copy of the body or its links.
   */
  async sendUnrecordedMail(params: {
    recipient: string;
    emailType: EmailType;
    subject: string;
    context: ISendMailOptions["context"];
  }): Promise<Result<{ messageId: string }, DeliveryFailure>> {
    const { recipient, emailType, subject, context } = params;
    if (!mailSendingEnabled() || isAnonymizedEmail(recipient)) {
      return R.failure(DeliveryFailure.Unavailable);
    }
    const prepared = await R.fromPromise(this.prepareSend(emailType, context));
    if (!prepared.ok) {
      this.logFailure({ emailType, error: prepared.error });
      return R.failure(DeliveryFailure.Unavailable);
    }
    const { from, rendered } = prepared.value;
    const sent = await R.fromPromise(
      withTimeout(
        this.transmit({
          recipient,
          from,
          emailType,
          subject,
          html: rendered,
          providerTracking: false,
        }),
        this.sendTimeoutMs,
      ),
    );
    if (!sent.ok) {
      this.logFailure({ emailType, error: sent.error });
      return R.failure(DeliveryFailure.Failed);
    }
    if (sent.value === TIMED_OUT) {
      this.logger.warn(
        `Unrecorded ${emailType} email timed out after ${this.sendTimeoutMs}ms`,
      );
      return R.failure(DeliveryFailure.Failed);
    }
    if (sent.value.accepted.length === 0) {
      this.logger.error(`Unrecorded ${emailType} email was not accepted`);
      return R.failure(DeliveryFailure.Failed);
    }
    return R.success({ messageId: sent.value.messageId });
  }

  /** Mail servers quote rejected addresses, normalized rather than as sent. */
  private logFailure(params: { emailType: EmailType; error: unknown }) {
    const { emailType, error } = params;
    const redact = (logged: string) =>
      logged.replace(
        /(?:"(?:[^"\\]|\\.)*"|[^\s<>()@"]+)@(?:\[[^\]]*\]|[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+)/gu,
        "[redacted]",
      );
    this.logger.error(
      redact(`Unrecorded ${emailType} email not sent: ${thrownMessage(error)}`),
      redact(thrownStack(error)),
    );
  }

  public async sendWelcomeEmail(params: {
    recipient: string;
    name: string;
    verifyToken: string;
  }): Promise<Mail> {
    const { recipient, name, verifyToken } = params;
    return this.sendMail({
      recipient,
      emailType: EmailType.Welcome,
      subject: "Welcome to the Alliance",
      context: {
        name,
        url: verifyEmailUrl(verifyToken),
      },
      tracking: null,
    });
  }

  public async sendPasswordResetEmail(params: {
    email: string;
    name: string;
    resetToken: string;
    hasPassword: boolean;
  }): Promise<Mail> {
    const { email, name, resetToken, hasPassword } = params;
    const url = passwordResetUrl(resetToken);
    const verb = hasPassword ? "reset" : "set";
    return this.sendMail({
      recipient: email,
      emailType: EmailType.PasswordReset,
      subject: `a link to ${verb} your password`,
      context: {
        name,
        url,
        verb,
      },
      tracking: null,
    });
  }

  public async sendContractSuspendedEmail(
    email: string,
    name: string,
  ): Promise<Mail> {
    return this.sendMail({
      recipient: email,
      emailType: EmailType.ContractSuspended,
      subject: "Alliance contract suspended",
      context: {
        name,
      },
      tracking: null,
    });
  }

  public async sendContractReinstatedEmail(params: {
    email: string;
    name: string;
  }): Promise<Mail> {
    return this.sendMail({
      recipient: params.email,
      emailType: EmailType.ContractReinstated,
      subject: reinstatementMessage,
      context: {
        name: nameParts(params.name).firstname,
        link: tasksUrl(true),
      },
      tracking: null,
    });
  }

  public async sendContractReminderEmail(params: {
    userId: number;
    email: string;
    name: string;
    copy: ContractReminderCopy;
  }): Promise<Mail> {
    const { subject, link } = CONTRACT_REMINDER_CONTENT[params.copy];
    return this.sendMail({
      recipient: params.email,
      emailType: EmailType.ContractReminder,
      subject,
      context: {
        copy: params.copy,
        subject,
        name: params.name,
        link: link(),
      },
      tracking: {
        owner: { userId: params.userId },
        source: MessageSource.ContractReminder,
        context: { contractReminderCopy: params.copy, subject },
        actionEventNotifId: null,
      },
    });
  }

  public async sendWaitlistLinkEmail(params: {
    recipient: string;
    emailType: WaitlistEmailType;
    url: string;
    unsubscribeUrl: string;
  }): Promise<Mail> {
    const { recipient, emailType, url, unsubscribeUrl } = params;
    return this.sendMail({
      recipient,
      emailType,
      subject: WAITLIST_SUBJECTS[emailType],
      context: { url, unsubscribeUrl },
      tracking: null,
    });
  }

  renderWaitlistStaffEmail(content: WaitlistStaffEmail): Promise<string> {
    return this.renderHtml(EmailType.WaitlistStaff, content);
  }

  /** Whether the mail server can be reached; true while sending is off. */
  async verifyTransport(): Promise<boolean> {
    if (!mailSendingEnabled()) return true;
    const verified = await R.fromPromise(
      this.mailerService.verifyAllTransporters(),
    );
    return verified.ok && verified.value;
  }

  public async sendWaitlistStaffEmail(params: {
    recipient: string;
    content: WaitlistStaffEmail;
    tracking: TrackedMessage | null;
  }): Promise<Mail> {
    return this.sendMail({
      recipient: params.recipient,
      emailType: EmailType.WaitlistStaff,
      subject: params.content.subject,
      context: params.content,
      tracking: params.tracking,
    });
  }

  public async sendActionEventNotificationEmail(params: {
    subject: string;
    message: string;
    tracking: TrackedMessage;
    recipient: string;
  }): Promise<Mail> {
    const { message, ...rest } = params;
    return this.sendCustomHtmlEmail({
      ...rest,
      html: message.replace(/\n/g, "<br>"),
    });
  }

  public async sendCustomHtmlEmail(params: {
    subject: string;
    html: string;
    tracking: TrackedMessage;
    recipient: string;
  }): Promise<Mail> {
    const { subject, html, tracking, recipient } = params;
    return this.sendMail({
      recipient,
      emailType: EmailType.CustomActionReminder,
      subject,
      context: { customMessage: html },
      tracking,
    });
  }

  async setClickedLinkByCid(cid: string): Promise<void> {
    const mail = await this.mailRepository.findOne({ where: { cid } });
    if (!mail) {
      throw new NotFoundException("Mail not found");
    }
    mail.clickedLink = true;
    await this.mailRepository.save(mail);
  }
}
