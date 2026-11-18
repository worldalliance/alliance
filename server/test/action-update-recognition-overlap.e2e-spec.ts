import { Logger } from "@nestjs/common";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import {
  setUpRecognition,
  type RecognitionFixture,
} from "./action-update-recognition-fixtures";
import { closeTestApp } from "./e2e-test-utils";

describe("action update recognition when deliveries overlap (e2e)", () => {
  let fixture: RecognitionFixture;

  beforeAll(async () => {
    fixture = await setUpRecognition();
  });

  afterAll(async () => {
    await closeTestApp(fixture.ctx.app);
  });

  beforeEach(() => fixture.reset());

  const pauseFirstText = () => {
    const mms = fixture.ctx.app.get(MmsService);
    const sendMmsResult = mms.sendMmsResult.bind(mms);
    const textStarted = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const texts = jest
      .spyOn(mms, "sendMmsResult")
      .mockImplementationOnce(async (params) => {
        textStarted.resolve();
        await resume.promise;
        return sendMmsResult(params);
      });
    const emails = jest.spyOn(
      fixture.ctx.app.get(MailService),
      "sendCustomHtmlEmail",
    );
    const restore = () => {
      texts.mockRestore();
      emails.mockRestore();
    };
    return { texts, emails, textStarted, resume, restore };
  };

  it("never resends a channel a paused run started, and stops that run once its claim is retaken", async () => {
    const { ctx, recognition, createMember, createUpdate, notify, exposureOf } =
      fixture;
    const member = await createMember();
    const id = await createUpdate();
    await notify(id).expect(200);
    const { texts, emails, textStarted, resume, restore } = pauseFirstText();
    const warn = jest.spyOn(Logger.prototype, "warn");
    try {
      const paused = recognition.deliverPrepared();
      await textStarted.promise;
      await ctx.dataSource.query(
        `UPDATE action_update_exposure SET "deliveryClaimedAt" = now() - interval '11 minutes' WHERE "userId" = $1`,
        [member.id],
      );

      await recognition.deliverPrepared();
      const retaken = await exposureOf(id, member.id);
      expect(retaken.deliveredAt).not.toBeNull();
      expect(retaken.textStartedAt).not.toBeNull();
      expect(retaken.mms).toBeNull();
      expect(retaken.mail).not.toBeNull();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "textStartedAt is set with no recorded outcome",
        ),
      );

      resume.resolve();
      await paused;
      expect(texts).toHaveBeenCalledTimes(1);
      expect(emails).toHaveBeenCalledTimes(1);
      const after = await exposureOf(id, member.id);
      expect(after.mms).not.toBeNull();
      expect(after.deliveredAt).toEqual(retaken.deliveredAt);
    } finally {
      restore();
      warn.mockRestore();
    }
  });

  const retakeClaim = `"deliveryClaimedAt" = now() + interval '1 second'`;
  it.each([
    ["its claim is retaken", retakeClaim],
    [
      "the run that retook its claim is sending the email",
      `${retakeClaim}, "emailStartedAt" = now()`,
    ],
    ["its exposure is deleted", `"deletedAt" = now()`],
  ])("starts and warns of no further channel once %s", async (_, change) => {
    const { ctx, recognition, createMember, createUpdate, notify } = fixture;
    const member = await createMember();
    const id = await createUpdate();
    await notify(id).expect(200);
    const { emails, textStarted, resume, restore } = pauseFirstText();
    const warn = jest.spyOn(Logger.prototype, "warn");
    try {
      const paused = recognition.deliverPrepared();
      await textStarted.promise;
      const [[before]] = await ctx.dataSource.query(
        `UPDATE action_update_exposure SET ${change} WHERE "userId" = $1 RETURNING "emailStartedAt"`,
        [member.id],
      );
      resume.resolve();
      await paused;

      expect(emails).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      const [after] = await ctx.dataSource.query(
        `SELECT "emailStartedAt" FROM action_update_exposure WHERE "userId" = $1 AND "actionUpdateId" = $2`,
        [member.id, id],
      );
      expect(after.emailStartedAt).toEqual(before.emailStartedAt);
    } finally {
      restore();
      warn.mockRestore();
    }
  });
});
