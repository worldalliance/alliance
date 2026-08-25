import { withCount } from "@alliance/common/plural";
import { ISendMailOptions, MailerService } from "@nestjs-modules/mailer";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionEvent } from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { getTimeLeftString } from "src/notifs/textnotifcontents";
import { groupMembersListUrl, tasksUrl, withCid } from "src/search/approutes";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "src/utils/Repository";
import { EmailStatus, EmailType, Mail } from "./mail.entity";

function interpretEscapes(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

export function processKeywordReplacements(
  text: string,
  context: {
    user: User;
    action: Action;
    deadlineEvent?: ActionEvent;
    cid: string;
    uncompletedTasksCount: number;
    uncompletedTasksTime: string;
    uncompletedTasksNames: string[];
    dateNow?: Date;
    uncompletedMembersInGroupCount?: number;
  },
): string {
  const names = context.user.name.split(" ");
  const dateNow = context.dateNow ?? new Date();
  let firstname = "";
  let lastname = "";
  if (names.length < 2) {
    console.error("User name has less than 2 parts: " + context.user.name);
    firstname = context.user.name;
  } else {
    firstname = names[0];
    lastname = names[names.length - 1];
  }
  let str = text
    .replaceAll("#{fullname}", context.user.name)
    .replaceAll("#{firstname}", firstname)
    .replaceAll("#{nmembers}", () =>
      context.uncompletedMembersInGroupCount === undefined
        ? "0"
        : context.uncompletedMembersInGroupCount.toString(),
    )
    .replaceAll("#{grouplink}", withCid(groupMembersListUrl(true), context.cid))
    .replaceAll("#{lastname}", lastname)
    .replaceAll("#{action}", context.action.name)
    .replaceAll("#{tasknames}", context.uncompletedTasksNames.join(", "))
    .replaceAll("#{n}", context.uncompletedTasksCount.toString())
    .replaceAll("#{tasktime}", context.uncompletedTasksTime)
    .replaceAll("#{s}", context.uncompletedTasksCount === 1 ? "" : "s")
    .replaceAll(
      "#{days}",
      context.deadlineEvent
        ? getTimeLeftString(context.deadlineEvent, dateNow, "days")
        : "[err]",
    )
    .replaceAll(
      "#{hours}",
      context.deadlineEvent
        ? getTimeLeftString(context.deadlineEvent, dateNow, "hours")
        : "[err]",
    )
    .replaceAll(
      "#{timeremaining}",
      context.deadlineEvent
        ? getTimeLeftString(context.deadlineEvent, dateNow)
        : "[err]",
    )
    .replaceAll("#{link}", withCid(tasksUrl(true), context.cid))
    .replaceAll(
      "#{formattedtasklist}",
      context.uncompletedTasksCount === 1
        ? context.uncompletedTasksNames.join(", ")
        : context.uncompletedTasksNames
            .map((name, index) => `${index + 1}. ${name}`)
            .join("\n"),
    );

  while (str.includes("|") && str.includes("#{") && str.includes("}")) {
    const idx_start = str.indexOf("#{");
    const idx_separator = str.indexOf("|", idx_start);
    const idx_end = str.indexOf("}", idx_separator);
    const st_one = interpretEscapes(
      str.substring(idx_start + 2, idx_separator),
    );
    const st_many = interpretEscapes(str.substring(idx_separator + 1, idx_end));
    if (context.uncompletedTasksCount === 1) {
      str = str.substring(0, idx_start) + st_one + str.substring(idx_end + 1);
    } else {
      str = str.substring(0, idx_start) + st_many + str.substring(idx_end + 1);
    }
  }

  return str;
}

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(Mail)
    private readonly mailRepository: Repository<Mail>,
  ) {}

  private readonly templates: Record<EmailType, string> = {
    [EmailType.Welcome]: "welcome",
    [EmailType.PasswordReset]: "password-reset",
    [EmailType.Verification]: "",
    [EmailType.Other]: "",
    [EmailType.PartialSignup]: "partial-signup",
    [EmailType.Commitment]: "commitment",
    [EmailType.MemberAction]: "memberaction",
    [EmailType.CommitmentReminder]: "commitmentreminder",
    [EmailType.MemberActionReminder]: "memberactionreminder",
    [EmailType.ForumDigest]: "forumdigest",
    [EmailType.ForumReply]: "forumreply",
    [EmailType.MissedDeadline]: "misseddeadline",
    [EmailType.MissedSecondDeadline]: "missedseconddeadline",
    [EmailType.CustomActionReminder]: "customactionreminder",
    [EmailType.ContractSuspended]: "contractsuspended",
    [EmailType.ContractReminder]: "contractreminder",
  };

  async renderHtml(emailType: EmailType, context: ISendMailOptions["context"]) {
    const pug = await import("pug");

    return pug.renderFile(
      __dirname + `/templates/${this.templates[emailType]}.pug`,
      { ...context },
    );
  }

  async sendMail(params: {
    recipient: string;
    emailType: EmailType;
    subject: string | null;
    context: ISendMailOptions["context"];
    cid: string | null;
  }): Promise<Mail> {
    const { recipient, emailType, subject, context, cid } = params;
    const mail = this.mailRepository.create({
      sentMessageId: null,
      renderedHtml: null,
      to: recipient,
      emailType: emailType,
      status: EmailStatus.Pending,
      cid,
    });

    if (
      process.env.NODE_ENV === "test" ||
      !(
        process.env.NODE_ENV === "production" ||
        process.env.SEND_DEV_NOTIFS === "1"
      )
    ) {
      return await this.mailRepository.save(mail);
    }

    const tag =
      process.env.NODE_ENV === "production" ? "production" : "development";

    const html = await this.renderHtml(emailType, context);

    const e = await this.mailerService.sendMail({
      to: recipient,
      from: "Alliance <alliance@worldalliance.org>",
      subject: subject ?? undefined,
      headers: {
        "o:tag": emailType,
        "X-Mailgun-Tag": tag,
      },
      html,
    });

    const accepted = e.accepted as string[];
    const messageId = e.messageId as string;

    if (accepted.length > 0) {
      mail.status = EmailStatus.Sent;
    } else {
      mail.status = EmailStatus.Failed;
    }
    mail.sentMessageId = messageId;
    mail.renderedHtml = html;
    return this.mailRepository.save(mail);
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
        url: `${process.env.APP_URL}/verifyEmail?token=${verifyToken}`,
      },
      cid: null,
    });
  }

  private getPasswordResetUrl(resetToken: string) {
    return `${process.env.APP_URL}/resetpassword?token=${resetToken}`; //todo: domain param
  }

  public async sendPasswordResetEmail(params: {
    email: string;
    name: string;
    resetToken: string;
  }): Promise<Mail> {
    const { email, name, resetToken } = params;
    const url = this.getPasswordResetUrl(resetToken);
    return this.sendMail({
      recipient: email,
      emailType: EmailType.PasswordReset,
      subject: "a link to reset your password",
      context: {
        name,
        url,
      },
      cid: null,
    });
  }

  public async sendPartialSignupEmail(params: {
    email: string;
    name: string;
    resetToken: string;
  }): Promise<Mail> {
    const { email, name, resetToken } = params;
    const url = this.getPasswordResetUrl(resetToken);
    return this.sendMail({
      recipient: email,
      emailType: EmailType.PartialSignup,
      subject: "Thanks for helping out! Want to do more?",
      context: {
        name,
        email,
        url,
      },
      cid: null,
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
      cid: null,
    });
  }

  public async sendContractReminderEmail(
    email: string,
    name: string,
  ): Promise<Mail> {
    return this.sendMail({
      recipient: email,
      emailType: EmailType.ContractReminder,
      subject: "Sign your membership contract to participate in actions",
      context: {
        name,
        link: `${process.env.APP_URL}/tasks`,
      },
      cid: null,
    });
  }

  public async sendForumDigestEmail(params: {
    email: string;
    name: string;
    unreadCount: number;
    notifications: {
      message: string;
      url?: string | null;
      createdAt: string;
    }[];
    cid: string;
  }): Promise<Mail> {
    const { email, name, unreadCount, notifications, cid } = params;
    const subject = `You have ${withCount(unreadCount, "unread Alliance forum notification")}`;

    return this.sendMail({
      recipient: email,
      emailType: EmailType.ForumDigest,
      subject,
      context: {
        name,
        count: unreadCount,
        notifications: notifications.map((item) => ({
          message: item.message,
          url: item.url,
          createdAt: item.createdAt,
        })),
        appUrl: process.env.APP_URL,
      },
      cid,
    });
  }

  public async sendActionEventNotificationEmail(params: {
    subject: string;
    message: string;
    cid: string;
    recipient: string;
  }): Promise<Mail> {
    const { subject, message, cid, recipient } = params;
    return this.sendMail({
      recipient,
      emailType: EmailType.CustomActionReminder,
      subject,
      context: {
        customMessage: message.replace(/\n/g, "<br>"),
      },
      cid,
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
