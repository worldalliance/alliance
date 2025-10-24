import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActionStatus } from 'src/actions/entities/action-event.entity';
import { ActionEventNotificationContext } from 'src/notifs/action-event-notif.worker';
import { ActionEventNotifType } from 'src/notifs/entities/action-event-notif.entity';
import { actionUrl, withCid } from 'src/search/approutes';
import { Repository } from 'typeorm';
import { EmailStatus, EmailType, Mail } from './mail.entity';
import { getDaysFromDeadline } from 'src/notifs/textnotifcontents';

export function processKeywordReplacements(
  text: string,
  context: ActionEventNotificationContext,
): string {
  return text
    .replace('#{name}', context.user.name)
    .replace('#{action}', context.action.name)
    .replace(
      '#{days}',
      context.deadlineEvent
        ? getDaysFromDeadline(context.deadlineEvent)
        : '[err]',
    )
    .replace(
      '#{link}',
      withCid(actionUrl(context.action.id, true), context.cid),
    );
}

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(Mail)
    private readonly mailRepository: Repository<Mail>,
  ) {}

  private readonly templates: Record<EmailType, string> = {
    [EmailType.Welcome]: 'welcome',
    [EmailType.PasswordReset]: 'password-reset',
    [EmailType.Verification]: '',
    [EmailType.Other]: '',
    [EmailType.PartialSignup]: 'partial-signup',
    [EmailType.Commitment]: 'commitment',
    [EmailType.MemberAction]: 'memberaction',
    [EmailType.CommitmentReminder]: 'commitmentreminder',
    [EmailType.MemberActionReminder]: 'memberactionreminder',
    [EmailType.ForumDigest]: 'forumdigest',
    [EmailType.MissedDeadline]: 'misseddeadline',
    [EmailType.MissedSecondDeadline]: 'missedseconddeadline',
    [EmailType.CustomActionReminder]: 'customactionreminder',
  };

  async sendMail(
    recipient: string,
    emailType: EmailType,
    subject: string | null,
    context: ISendMailOptions['context'],
    cid?: string,
  ): Promise<Mail> {
    if (process.env.NODE_ENV === 'test') {
      return {
        id: 0,
        sentMessageId: 'test',
        to: recipient,
        cid,
        clickedLink: false,
        status: EmailStatus.Sent,
        emailType: emailType,
        createdAt: new Date(),
      };
    }
    const mail = await this.mailRepository.create({
      to: recipient,
      emailType: emailType,
      status: EmailStatus.Pending,
      cid,
    });

    const pug = await import('pug');

    const tag =
      process.env.NODE_ENV === 'production' ? 'production' : 'development';

    const html = pug.renderFile(
      __dirname + `/../../mail/templates/${this.templates[emailType]}.pug`,
      { ...context },
    );

    console.log('html', html);

    const e = await this.mailerService.sendMail({
      to: recipient,
      from: 'Alliance <alliance@worldalliance.org>',
      subject: subject ?? undefined,
      headers: {
        'o:tag': emailType,
        'X-Mailgun-Tag': tag,
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
    return this.mailRepository.save(mail);
  }

  public async sendWelcomeEmail(
    recipient: string,
    name: string,
    verifyToken: string,
  ): Promise<Mail> {
    return this.sendMail(
      recipient,
      EmailType.Welcome,
      'Welcome to the Alliance',
      {
        name,
        url: `${process.env.APP_URL}/verifyEmail?token=${verifyToken}`,
      },
    );
  }

  private getPasswordResetUrl(resetToken: string) {
    return `${process.env.APP_URL}/resetpassword?token=${resetToken}`; //todo: domain param
  }

  public async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<Mail> {
    const url = this.getPasswordResetUrl(resetToken);
    return this.sendMail(
      email,
      EmailType.PasswordReset,
      'a link to reset your password',
      {
        name,
        url,
      },
    );
  }

  public async sendPartialSignupEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<Mail> {
    const url = this.getPasswordResetUrl(resetToken);
    return this.sendMail(
      email,
      EmailType.PartialSignup,
      'Thanks for helping out! Want to do more?',
      {
        name,
        email,
        url,
      },
    );
  }

  public async sendForumDigestEmail(
    email: string,
    name: string,
    unreadCount: number,
    notifications: {
      message: string;
      url?: string | null;
      createdAt: string;
    }[],
    cid: string,
  ): Promise<Mail> {
    const subject = `You have ${unreadCount} unread Alliance forum notification${unreadCount === 1 ? '' : 's'}`;

    return this.sendMail(
      email,
      EmailType.ForumDigest,
      subject,
      {
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
    );
  }

  getSubject(context: ActionEventNotificationContext): string {
    if (context.type === ActionEventNotifType.Announcement) {
      if (context.event.newStatus === ActionStatus.GatheringCommitments) {
        return 'New action: ' + context.action.name;
      }
      if (context.event.newStatus === ActionStatus.MemberAction) {
        return 'Action needs completion: ' + context.action.name;
      }
      throw new Error(
        'Invalid announcement status: ' + context.event.newStatus,
      );
    } else if (context.type === ActionEventNotifType.Reminder) {
      return processKeywordReplacements(
        context.customEmailSubject ?? 'no subject',
        context,
      );
    } else if (context.type === ActionEventNotifType.MissedDeadline) {
      return 'Failed to complete action: ' + context.action.name;
    }
    throw new Error(
      'Invalid event in mail context: ' + (context.type satisfies never),
    );
  }

  public async sendActionEventNotificationEmail(
    context: ActionEventNotificationContext,
  ): Promise<Mail> {
    const subject = context.customEmailSubject ?? this.getSubject(context);

    let emailType: EmailType | null = null;

    if (context.type === ActionEventNotifType.Announcement) {
      emailType =
        context.event.newStatus === ActionStatus.GatheringCommitments
          ? EmailType.Commitment
          : EmailType.MemberAction;
    } else if (context.type === ActionEventNotifType.Reminder) {
      emailType = EmailType.CustomActionReminder;
    } else if (context.type === ActionEventNotifType.MissedDeadline) {
      emailType = context.isSecondMiss
        ? EmailType.MissedSecondDeadline
        : EmailType.MissedDeadline;
    }
    if (!emailType) {
      throw new Error(
        'Invalid event in mail context: ' + JSON.stringify(context),
      );
    }

    const hasDeadline = context.deadlineEvent !== undefined;
    let daysLeft = '';
    if (context.deadlineEvent) {
      daysLeft = getDaysFromDeadline(context.deadlineEvent);
    }

    const emailContext = {
      name: context.user.name,
      actionName: context.action.name,
      url: withCid(actionUrl(context.action.id, true), context.cid),
      commitmentless: context.action.commitmentless,
      hasDeadline,
      daysLeft,
      customMessage: context.customEmailMessage
        ? context.customEmailMessage.replace(/\n/g, '<br>')
        : undefined,
      cid: context.cid,
    };

    console.log('emailContext', emailContext.customMessage);

    return this.sendMail(
      context.user.email,
      emailType,
      subject,
      emailContext,
      context.cid,
    );
  }

  async setClickedLinkByCid(cid: string): Promise<void> {
    const mail = await this.mailRepository.findOne({ where: { cid } });
    if (!mail) {
      throw new NotFoundException('Mail not found');
    }
    mail.clickedLink = true;
    await this.mailRepository.save(mail);
  }
}
