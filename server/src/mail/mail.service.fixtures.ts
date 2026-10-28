import { MailerService, type ISendMailOptions } from "@nestjs-modules/mailer";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  MessageTrackingService,
  type TrackedMessage,
} from "src/link-tracking/message-tracking.service";
import { Mail } from "./mail.entity";
import { MailService } from "./mail.service";

export async function harness(
  sendMail: (
    options: ISendMailOptions,
  ) => Promise<{ accepted: string[]; messageId: string }>,
  other: {
    saveFails?: boolean;
    trackFails?: boolean;
    verifyAllTransporters?: () => Promise<boolean>;
  } = {},
) {
  const saves: Mail[] = [];
  const tracked: TrackedMessage[] = [];
  const discarded: string[] = [];
  const moduleRef = await Test.createTestingModule({
    providers: [
      MailService,
      {
        provide: MailerService,
        useValue: {
          sendMail,
          verifyAllTransporters: other.verifyAllTransporters,
        },
      },
      {
        provide: MessageTrackingService,
        useValue: {
          track: (input: { message: TrackedMessage }) => {
            if (other.trackFails) {
              return Promise.reject(new Error("insert failed"));
            }
            tracked.push(input.message);
            return Promise.resolve("track-1");
          },
          discard: (trackingId: string) => {
            discarded.push(trackingId);
            return Promise.resolve();
          },
        },
      },
      {
        provide: getRepositoryToken(Mail),
        useValue: {
          create: (mail: Partial<Mail>) => ({ ...mail }),
          save: (mail: Mail) => {
            if (other.saveFails) {
              return Promise.reject(new Error("connection lost"));
            }
            saves.push({ ...mail });
            return Promise.resolve(mail);
          },
        },
      },
    ],
  }).compile();

  return { service: moduleRef.get(MailService), saves, tracked, discarded };
}

export function useMailSendingEnv() {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.MAIL_FROM = "Alliance <alliance@thealliance.org>";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });
}
