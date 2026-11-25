import { MmsOptout } from "src/mms/mms-optout.entity";
import { Mms } from "src/mms/mms.entity";
import { MmsModule } from "src/mms/mms.module";
import { MmsService } from "src/mms/mms.service";
import { TwilioStatusWorker } from "src/mms/twiliostatus.worker";
import { ReferralSource, User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp([MmsModule]);
});

afterAll(async () => {
  await closeTestApp(ctx.app);
});

describe("Mms Twilio address columns (e2e)", () => {
  let mmsRepo: Repository<Mms>;
  let mmsService: MmsService;

  beforeAll(() => {
    mmsRepo = ctx.dataSource.getRepository(Mms);
    mmsService = ctx.app.get(MmsService);
  });

  const save = async (to: string, from: string) => {
    const saved = await mmsRepo.save(
      mmsRepo.create({
        to,
        from,
        body: "hello",
        status: "sent",
        twilioSid: "test-sid",
      }),
    );
    return mmsRepo.findOneByOrFail({ id: saved.id });
  };

  it("preserves Twilio recipient addresses exactly", async () => {
    for (const recipient of [
      "+14155552671",
      "(415) 555-2671",
      "894546",
      "whatsapp:+14155552671",
    ]) {
      const stored = await save(recipient, "+14155552672");

      expect(stored.to).toBe(recipient);
    }
  });

  it("preserves Twilio sender identifiers exactly", async () => {
    for (const sender of ["TLNET", "2650011", "+59039149", "415.555.2672"]) {
      const stored = await save("+14155552671", sender);

      expect(stored.from).toBe(sender);
    }
  });

  it("refreshes only fields owned by Twilio", async () => {
    const original = await mmsRepo.save(
      mmsRepo.create({
        to: "+14155552671",
        from: "+15555550100",
        body: "original body",
        status: "queued",
        twilioSid: "refresh-test-sid",
        cid: "local-correlation-id",
        clickedLink: true,
      }),
    );
    Object.defineProperty(mmsService, "twilioClient", {
      configurable: true,
      value: {
        messages: {
          get: () => ({
            fetch: async () => ({
              id: original.id + 1,
              to: "+442079460958",
              from: "TLNET",
              body: "provider body",
              status: "delivered",
              errorCode: null,
              errorMessage: null,
              cid: "provider-correlation-id",
              clickedLink: false,
            }),
          }),
        },
      },
    });

    const refreshed = await ctx.app
      .get(TwilioStatusWorker)
      .refreshMmsData(original);

    expect(refreshed).toMatchObject({
      id: original.id,
      to: "+442079460958",
      from: "TLNET",
      body: "provider body",
      status: "delivered",
      errorCode: null,
      errorMessage: null,
      cid: "local-correlation-id",
      clickedLink: true,
    });
  });

  it("normalizes the opt-out log the same way", async () => {
    const optoutRepo = ctx.dataSource.getRepository(MmsOptout);
    const userRepo = ctx.dataSource.getRepository(User);
    const user = await userRepo.save(
      userRepo.create({
        email: "optout-normalization@example.com",
        password: "pass",
        name: "Optout Normalization",
        referralSource: ReferralSource.None,
      }),
    );
    const saved = await optoutRepo.save(
      optoutRepo.create({
        phoneNumber: "(415) 555-2671",
        reason: "keyword",
        rawBody: "STOP",
        user: { id: user.id },
      }),
    );

    const stored = await optoutRepo.findOneByOrFail({ id: saved.id });
    expect(stored.phoneNumber).toBe("+14155552671");
    expect(stored.rawBody).toBe("STOP");
  });
});
