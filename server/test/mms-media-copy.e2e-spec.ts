import { setEnv } from "@alliance/common/set-env";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { MmsMedia } from "src/mms/mms-media.entity";
import {
  MAX_COPY_ATTEMPTS,
  mediaStatus,
  MmsMediaService,
  MmsMediaStatus,
} from "src/mms/mms-media.service";
import { Mms, MmsDirection } from "src/mms/mms.entity";
import { MmsModule } from "src/mms/mms.module";
import { IsNull, type Repository } from "typeorm";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

const TWILIO_NUMBER = "+15555550100";
const MEDIA_URL =
  "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123";

let ctx: TestContext;
let mmsRepo: Repository<Mms>;
let mediaService: MmsMediaService;
const savedEnv = {
  ASSETS_BUCKET: process.env.ASSETS_BUCKET,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
};

beforeAll(async () => {
  process.env.ASSETS_BUCKET = "test-bucket";
  ctx = await createTestApp([MmsModule]);
  mmsRepo = ctx.dataSource.getRepository(Mms);
  mediaService = ctx.app.get(MmsMediaService);
}, 50000);

afterAll(async () => {
  await closeTestApp(ctx.app);
  for (const [name, value] of Object.entries(savedEnv)) setEnv(name, value);
});

describe("Inbound media copy (e2e)", () => {
  let mediaRepo: Repository<MmsMedia>;
  let s3Send: jest.Mock;
  let fetchMock: jest.SpyInstance;

  const saveMedia = async (
    params: { from: string } & Partial<
      Pick<
        MmsMedia,
        | "createdAt"
        | "copyAttempts"
        | "lastCopyAttemptAt"
        | "s3Key"
        | "twilioDeleteAttempts"
        | "lastTwilioDeleteAttemptAt"
      >
    >,
  ) => {
    const mms = await mmsRepo.save(
      mmsRepo.create({
        to: TWILIO_NUMBER,
        from: params.from,
        direction: MmsDirection.Inbound,
        body: "",
        status: "received",
        twilioSid: randomUUID(),
      }),
    );
    return mediaRepo.save(
      mediaRepo.create({
        mmsId: mms.id,
        twilioUrl: MEDIA_URL,
        contentType: "image/png",
        s3Key: params.s3Key ?? null,
        copyAttempts: params.copyAttempts ?? 0,
        lastCopyAttemptAt: params.lastCopyAttemptAt ?? null,
        twilioDeleteAttempts: params.twilioDeleteAttempts ?? 0,
        lastTwilioDeleteAttemptAt: params.lastTwilioDeleteAttemptAt ?? null,
        createdAt: params.createdAt,
      }),
    );
  };
  const twilioAnswers = (fetchStatus: number, deleteStatus = 204) =>
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "DELETE"
        ? new Response(null, { status: deleteStatus })
        : new Response(new Uint8Array([1, 2, 3]), { status: fetchStatus }),
    );
  const withDelivery = async (run: () => Promise<void>) => {
    const previous = process.env.SEND_DEV_NOTIFS;
    setEnv("SEND_DEV_NOTIFS", "1");
    try {
      await run();
    } finally {
      setEnv("SEND_DEV_NOTIFS", previous);
    }
  };
  const fetched = () =>
    fetchMock.mock.calls.map(([url, init]) => [url, init?.method]);
  const reload = (id: number) => mediaRepo.findOneByOrFail({ id });
  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000);

  beforeEach(() => {
    mediaRepo = ctx.dataSource.getRepository(MmsMedia);
    s3Send = jest.fn().mockResolvedValue({});
    Object.assign(ctx.app.get<S3Client>("S3_CLIENT"), { send: s3Send });
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    fetchMock = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("copies to S3, then deletes the Twilio copy", async () => {
    const media = await saveMedia({ from: "+14155558301" });
    twilioAnswers(200);

    await mediaService.copyToS3([media]);

    const put: PutObjectCommand = s3Send.mock.calls[0][0];
    expect(put.input).toMatchObject({
      Bucket: "test-bucket",
      ContentType: "image/png",
    });
    expect(await reload(media.id)).toMatchObject({
      s3Key: put.input.Key,
      twilioDeletedAt: expect.any(Date),
    });
    expect(fetched()).toEqual([
      [MEDIA_URL, undefined],
      [`${MEDIA_URL}.json`, "DELETE"],
    ]);
    expect(mediaStatus(await reload(media.id))).toBe(MmsMediaStatus.Ready);
  });

  it("retries deleting the Twilio copy when Twilio refused it", async () => {
    await mediaRepo.update({ s3Key: IsNull() }, { s3Key: "mms-media/old" });
    await mediaRepo.update(
      { twilioDeletedAt: IsNull() },
      { twilioDeletedAt: new Date() },
    );
    const media = await saveMedia({ from: "+14155558306" });
    twilioAnswers(200, 500);
    await mediaService.copyToS3([media]);
    expect(await reload(media.id)).toMatchObject({
      s3Key: expect.any(String),
      twilioDeletedAt: null,
      twilioDeleteAttempts: 1,
      lastTwilioDeleteAttemptAt: expect.any(Date),
    });
    await mediaRepo.update(media.id, {
      lastTwilioDeleteAttemptAt: minutesAgo(3),
    });

    twilioAnswers(200);
    fetchMock.mockClear();
    await withDelivery(() => mediaService.copyPending());

    expect((await reload(media.id)).twilioDeletedAt).toEqual(expect.any(Date));
    expect(fetched()).toEqual([[`${MEDIA_URL}.json`, "DELETE"]]);
  });

  it("deletes its upload when another copy claimed the row first", async () => {
    const media = await saveMedia({ from: "+14155558302" });
    await mediaRepo.update(media.id, { s3Key: "mms-media/first" });
    twilioAnswers(200);

    await mediaService.copyToS3([media]);

    const [put, removed]: unknown[] = s3Send.mock.calls.map(([c]) => c);
    if (!(put instanceof PutObjectCommand)) throw new Error("no upload");
    if (!(removed instanceof DeleteObjectCommand)) throw new Error("no delete");
    expect(removed.input.Key).toBe(put.input.Key);
    expect((await reload(media.id)).s3Key).toBe("mms-media/first");
    expect(fetched()).toEqual([[MEDIA_URL, undefined]]);
  });

  it("logs the key of an upload it couldn't delete", async () => {
    const media = await saveMedia({ from: "+14155558314" });
    await mediaRepo.update(media.id, { s3Key: "mms-media/first" });
    twilioAnswers(200);
    s3Send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("s3 down"));
    const logged = jest.spyOn(mediaService["logger"], "error");

    await mediaService.copyToS3([media]);

    const [put]: unknown[] = s3Send.mock.calls.map(([c]) => c);
    if (!(put instanceof PutObjectCommand)) throw new Error("no upload");
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining(put.input.Key ?? "no key"),
      expect.anything(),
    );
  });

  it("deletes its upload when a failed claim didn't commit", async () => {
    const media = await saveMedia({ from: "+14155558309" });
    twilioAnswers(200);
    jest
      .spyOn(mediaService["mediaRepository"], "update")
      .mockRejectedValueOnce(new Error("db down"));

    await mediaService.copyToS3([media]);

    const [put, removed]: unknown[] = s3Send.mock.calls.map(([c]) => c);
    if (!(put instanceof PutObjectCommand)) throw new Error("no upload");
    if (!(removed instanceof DeleteObjectCommand)) throw new Error("no delete");
    expect(removed.input.Key).toBe(put.input.Key);
    expect(await reload(media.id)).toMatchObject({
      s3Key: null,
      copyAttempts: 1,
    });
    expect(fetched()).toEqual([[MEDIA_URL, undefined]]);
  });

  it("keeps its upload when a claim rejects after committing", async () => {
    const media = await saveMedia({ from: "+14155558311" });
    twilioAnswers(200);
    const repository = mediaService["mediaRepository"];
    const update = repository.update.bind(repository);
    jest
      .spyOn(repository, "update")
      .mockImplementationOnce(async (criteria, partial) => {
        await update(criteria, partial);
        throw new Error("connection reset after commit");
      });

    await mediaService.copyToS3([media]);

    const commands: unknown[] = s3Send.mock.calls.map(([c]) => c);
    const [put] = commands;
    if (!(put instanceof PutObjectCommand)) throw new Error("no upload");
    expect(commands).toHaveLength(1);
    expect(await reload(media.id)).toMatchObject({
      s3Key: put.input.Key,
      copyAttempts: 0,
    });
  });

  it("keeps its upload when it can't tell whether a failed claim committed", async () => {
    const media = await saveMedia({ from: "+14155558312" });
    twilioAnswers(200);
    const repository = mediaService["mediaRepository"];
    jest
      .spyOn(repository, "update")
      .mockRejectedValueOnce(new Error("db down"));
    jest
      .spyOn(repository, "findOneBy")
      .mockRejectedValueOnce(new Error("db down"));
    const logged = jest.spyOn(mediaService["logger"], "error");

    await mediaService.copyToS3([media]);

    const [put]: unknown[] = s3Send.mock.calls.map(([c]) => c);
    if (!(put instanceof PutObjectCommand)) throw new Error("no upload");
    expect(s3Send).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining(put.input.Key ?? "no key"),
      expect.anything(),
    );
    expect(await reload(media.id)).toMatchObject({
      s3Key: null,
      copyAttempts: 1,
    });
  });

  it("counts a deletion Twilio answers 404 as done", async () => {
    const media = await saveMedia({
      from: "+14155558315",
      s3Key: "mms-media/copied",
    });
    twilioAnswers(200, 404);

    await mediaService.deleteFromTwilio([media]);

    expect(await reload(media.id)).toMatchObject({
      twilioDeletedAt: expect.any(Date),
      twilioDeleteAttempts: 0,
    });
  });

  it("counts a refused deletion when Twilio credentials are missing", async () => {
    const media = await saveMedia({
      from: "+14155558310",
      s3Key: "mms-media/copied",
    });
    setEnv("TWILIO_AUTH_TOKEN", undefined);

    await mediaService.deleteFromTwilio([media]);

    expect((await reload(media.id)).twilioDeleteAttempts).toBe(1);
  });

  it("counts a failed copy", async () => {
    const media = await saveMedia({ from: "+14155558303" });
    twilioAnswers(500);

    await mediaService.copyToS3([media]);

    expect(await reload(media.id)).toMatchObject({
      s3Key: null,
      copyAttempts: 1,
      lastCopyAttemptAt: expect.any(Date),
    });
  });

  it("waits longer after each failed copy, up to a day, before retrying", async () => {
    await mediaRepo.update({ s3Key: IsNull() }, { s3Key: "mms-media/old" });
    const due = await saveMedia({
      from: "+14155558307",
      copyAttempts: 3,
      lastCopyAttemptAt: minutesAgo(9),
    });
    await saveMedia({
      from: "+14155558307",
      copyAttempts: 3,
      lastCopyAttemptAt: minutesAgo(7),
    });
    await saveMedia({
      from: "+14155558307",
      copyAttempts: 20,
      lastCopyAttemptAt: minutesAgo(23 * 60),
    });
    const capped = await saveMedia({
      from: "+14155558307",
      copyAttempts: 20,
      lastCopyAttemptAt: minutesAgo(25 * 60),
    });
    const copied = jest
      .spyOn(mediaService, "copyToS3")
      .mockResolvedValue(undefined);
    jest.spyOn(mediaService, "deleteFromTwilio").mockResolvedValue(undefined);

    await withDelivery(() => mediaService.copyPending());

    expect(copied.mock.calls[0][0].map((m: MmsMedia) => m.id)).toEqual([
      due.id,
      capped.id,
    ]);
  });

  it("waits longer after each refused deletion, up to a day, before retrying", async () => {
    await mediaRepo.update(
      { twilioDeletedAt: IsNull() },
      { twilioDeletedAt: new Date() },
    );
    const copied = { from: "+14155558313", s3Key: "mms-media/copied" };
    const due = await saveMedia({
      ...copied,
      twilioDeleteAttempts: 3,
      lastTwilioDeleteAttemptAt: minutesAgo(9),
    });
    await saveMedia({
      ...copied,
      twilioDeleteAttempts: 3,
      lastTwilioDeleteAttemptAt: minutesAgo(7),
    });
    await saveMedia({
      ...copied,
      twilioDeleteAttempts: 20,
      lastTwilioDeleteAttemptAt: minutesAgo(23 * 60),
    });
    const capped = await saveMedia({
      ...copied,
      twilioDeleteAttempts: 20,
      lastTwilioDeleteAttemptAt: minutesAgo(25 * 60),
    });
    jest.spyOn(mediaService, "copyToS3").mockResolvedValue(undefined);
    const deleted = jest
      .spyOn(mediaService, "deleteFromTwilio")
      .mockResolvedValue(undefined);

    await withDelivery(() => mediaService.copyPending());

    expect(deleted.mock.calls[0][0].map((m: MmsMedia) => m.id)).toEqual([
      due.id,
      capped.id,
    ]);
  });

  it("gives up on media Twilio no longer has", async () => {
    const media = await saveMedia({ from: "+14155558304" });
    twilioAnswers(404);

    await mediaService.copyToS3([media]);

    const reloaded = await reload(media.id);
    expect(reloaded.copyAttempts).toBe(MAX_COPY_ATTEMPTS);
    expect(mediaStatus(reloaded)).toBe(MmsMediaStatus.Unavailable);
  });

  it("logs nothing when another copy finished the row and deleted Twilio's file", async () => {
    const media = await saveMedia({ from: "+14155558316" });
    await mediaRepo.update(media.id, { s3Key: "mms-media/first" });
    twilioAnswers(404);
    const logged = jest.spyOn(mediaService["logger"], "error");

    await mediaService.copyToS3([media]);

    expect(logged).not.toHaveBeenCalled();
    expect((await reload(media.id)).copyAttempts).toBe(0);
  });

  it("leaves a just-stored row to the webhook's copy for a minute", async () => {
    await mediaRepo.update({ s3Key: IsNull() }, { s3Key: "mms-media/old" });
    await mediaRepo.update(
      { twilioDeletedAt: IsNull() },
      { twilioDeletedAt: new Date() },
    );
    await saveMedia({ from: "+14155558309" });
    await saveMedia({ from: "+14155558309", s3Key: "mms-media/just-copied" });
    const copied = jest
      .spyOn(mediaService, "copyToS3")
      .mockResolvedValue(undefined);
    const deleted = jest
      .spyOn(mediaService, "deleteFromTwilio")
      .mockResolvedValue(undefined);

    await withDelivery(() => mediaService.copyPending());

    expect(copied).toHaveBeenCalledWith([]);
    expect(deleted).toHaveBeenCalledWith([]);
  });

  it("retries fresh media first and skips media it gave up on", async () => {
    await mediaRepo.update({ s3Key: IsNull() }, { s3Key: "mms-media/old" });
    const createdAt = minutesAgo(60);
    const retried = await saveMedia({
      from: "+14155558305",
      copyAttempts: 3,
      createdAt,
    });
    const fresh = await saveMedia({ from: "+14155558305", createdAt });
    await saveMedia({ from: "+14155558305", copyAttempts: MAX_COPY_ATTEMPTS });
    const copied = jest
      .spyOn(mediaService, "copyToS3")
      .mockResolvedValue(undefined);
    jest.spyOn(mediaService, "deleteFromTwilio").mockResolvedValue(undefined);
    await withDelivery(() => mediaService.copyPending());

    expect(copied.mock.calls[0][0].map((m: MmsMedia) => m.id)).toEqual([
      fresh.id,
      retried.id,
    ]);
  });

  it("retries the deletions Twilio refused least often first", async () => {
    await mediaRepo.update(
      { twilioDeletedAt: IsNull() },
      { twilioDeletedAt: new Date() },
    );
    const refused = await saveMedia({
      from: "+14155558308",
      s3Key: "mms-media/refused",
      twilioDeleteAttempts: 5,
      createdAt: minutesAgo(60),
    });
    const fresh = await saveMedia({
      from: "+14155558308",
      s3Key: "mms-media/fresh",
      createdAt: minutesAgo(60),
    });
    jest.spyOn(mediaService, "copyToS3").mockResolvedValue(undefined);
    const deleted = jest
      .spyOn(mediaService, "deleteFromTwilio")
      .mockResolvedValue(undefined);

    await withDelivery(() => mediaService.copyPending());

    expect(deleted.mock.calls[0][0].map((m: MmsMedia) => m.id)).toEqual([
      fresh.id,
      refused.id,
    ]);
  });
});
