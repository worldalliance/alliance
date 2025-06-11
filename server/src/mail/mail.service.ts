import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { SentMessageInfo } from 'nodemailer';
import { EmailStatus, EmailType, Mail } from './mail.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(Mail)
    private readonly mailRepository: Repository<Mail>,
  ) {}

  private readonly templates = {
    [EmailType.Welcome]: 'welcome',
    [EmailType.PasswordReset]: 'password-reset',
    [EmailType.Verification]: 'verification',
    [EmailType.Other]: 'other',
  };

  async sendMail(
    recipient: string,
    emailType: EmailType,
    context: ISendMailOptions['context'],
  ): Promise<void> {
    const mail = await this.mailRepository.create({
      to: recipient,
      emailType: emailType,
    });

    this.mailerService
      .sendMail({
        to: 'casey@worldalliance.org',
        from: 'no-reply@worldalliance.org',
        subject: 'i am a very friendly email',
        template: __dirname + `/templates/${this.templates[emailType]}`,
        context,
      })
      .then((e: SentMessageInfo) => {
        const accepted = e.accepted as string[];
        const messageId = e.messageId as string;

        if (accepted.length > 0) {
          mail.status = EmailStatus.Sent;
        } else {
          mail.status = EmailStatus.Failed;
        }
        mail.sentMessageId = messageId || null;
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        this.mailRepository.save(mail);
      });
  }

  public async sendWelcomeEmail(
    recipient: string,
    name: string,
  ): Promise<void> {
    await this.sendMail(recipient, EmailType.Welcome, {
      name,
    });
  }
}
