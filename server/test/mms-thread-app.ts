import { randomUUID } from "crypto";
import { MmsMediaService } from "src/mms/mms-media.service";
import { Mms } from "src/mms/mms.entity";
import { MmsModule } from "src/mms/mms.module";
import { ReferralSource, User } from "src/user/entities/user.entity";
import supertest from "supertest";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { TWILIO_NUMBER } from "./mms-fixtures";

/** Registers hooks that start the MMS app, with media copies stubbed out,
 * so call it once at a spec file's top level. The helpers it returns work
 * only inside hooks and tests. */
export function mmsThreadApp() {
  let ctx: TestContext;
  let copyToS3: jest.SpyInstance;

  beforeAll(async () => {
    ctx = await createTestApp([MmsModule]);
    copyToS3 = jest
      .spyOn(ctx.app.get(MmsMediaService), "copyToS3")
      .mockResolvedValue();
  }, 50000);

  afterAll(() => closeTestApp(ctx.app));

  const mmsRepo = () => ctx.dataSource.getRepository(Mms);
  const userRepo = () => ctx.dataSource.getRepository(User);
  const server = () => ctx.app.getHttpServer();
  const admin = () => `Bearer ${ctx.adminAccessToken}`;

  const inbound = (params: {
    from: string;
    body: string;
    sid?: string;
    media?: { url: string; contentType: string }[];
  }) =>
    supertest(server())
      .post("/mms/inbound")
      .type("form")
      .send({
        From: params.from,
        To: TWILIO_NUMBER,
        Body: params.body,
        MessageSid: params.sid ?? randomUUID(),
        NumMedia: String(params.media?.length ?? 0),
        ...Object.fromEntries(
          (params.media ?? []).flatMap(({ url, contentType }, index) => [
            [`MediaUrl${index}`, url],
            [`MediaContentType${index}`, contentType],
          ]),
        ),
      });

  const thread = (userId: number) =>
    supertest(server())
      .get(`/mms-threads/${userId}`)
      .set("Authorization", admin());

  const send = (userId: number, body: string) =>
    supertest(server())
      .post(`/mms-threads/${userId}`)
      .set("Authorization", admin())
      .send({ body });

  const createMember = (phoneNumber: string | null) =>
    userRepo().save(
      userRepo().create({
        email: `${randomUUID()}@example.com`,
        password: "pass",
        name: "Texter",
        referralSource: ReferralSource.None,
        phoneNumber,
      }),
    );

  const saveBroadcast = (to: string) =>
    mmsRepo().save(
      mmsRepo().create({
        to,
        from: TWILIO_NUMBER,
        body: "New action live",
        status: "delivered",
        twilioSid: randomUUID(),
      }),
    );

  return {
    ctx: () => ctx,
    copyToS3: () => copyToS3,
    mmsRepo,
    userRepo,
    server,
    admin,
    inbound,
    thread,
    send,
    createMember,
    saveBroadcast,
  };
}
