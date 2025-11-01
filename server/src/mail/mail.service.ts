import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActionEvent } from 'src/actions/entities/action-event.entity';
import { tasksUrl, withCid } from 'src/search/approutes';
import { Repository } from 'typeorm';
import { EmailStatus, EmailType, Mail } from './mail.entity';
import {
  getDaysFromDeadline,
  getHoursFromDeadline,
} from 'src/notifs/textnotifcontents';
import { User } from 'src/user/entities/user.entity';
import { Action } from 'src/actions/entities/action.entity';

export function processKeywordReplacements(
  text: string,
  context: {
    user: User;
    action: Action;
    deadlineEvent?: ActionEvent;
    cid: string;
    uncompletedTasksCount: number;
  },
): string {
  const names = context.user.name.split(' ');
  let firstname = '';
  let lastname = '';
  if (names.length < 2) {
    console.error('User name has less than 2 parts: ' + context.user.name);
    firstname = context.user.name;
  } else {
    firstname = names[0];
    lastname = names[names.length - 1];
  }
  return text
    .replace('#{fullname}', context.user.name)
    .replace('#{firstname}', firstname)
    .replace('#{lastname}', lastname)
    .replace('#{action}', context.action.name)
    .replace('#{n}', context.uncompletedTasksCount.toString())
    .replace(
      '#{days}',
      context.deadlineEvent
        ? getDaysFromDeadline(context.deadlineEvent)
        : '[err]',
    )
    .replace(
      '#{hours}',
      context.deadlineEvent
        ? getHoursFromDeadline(context.deadlineEvent)
        : '[err]',
    )
    .replace('#{link}', withCid(tasksUrl(true), context.cid));
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
        id: Math.floor(Math.random() * 1000000),
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
    mail.renderedHtml = html;
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

  public async sendActionEventNotificationEmail(
    subject: string,
    message: string,
    cid: string,
    recipient: string,
  ): Promise<Mail> {
    return this.sendMail(
      recipient,
      EmailType.CustomActionReminder,
      subject,
      {
        customMessage: message.replace(/\n/g, '<br>'),
      },
      cid,
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
