import {
  KORA_UPLOAD_NEEDS_TRANSCRIPTS,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { randomUUID } from "node:crypto";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraModule } from "src/kora/kora.module";
import request from "supertest";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";
import { setKoraProjectStatus } from "./kora-fixtures";
import { koraPair, koraPairsFile } from "./kora-pairs";

describe("Kora transcript batches (e2e)", () => {
  let ctx: TestContext;
  let prefix: string;

  const server = () => request(ctx.app.getHttpServer());
  const upload = (params: { transcripts?: string; token?: string }) => {
    let req = server()
      .post("/kora/admin/batches")
      .set("Authorization", `Bearer ${params.token ?? ctx.adminAccessToken}`)
      .field("transcriptsPerAssignment", "10")
      .field("reviewsPerTranscript", "3");
    if (params.transcripts !== undefined) {
      req = req.attach(
        "transcripts",
        Buffer.from(params.transcripts),
        "pairs.jsonl",
      );
    }
    return req;
  };
  const asAdmin = (method: "get" | "put", path: string) =>
    server()
      [method](path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);
  const batchCount = () => ctx.dataSource.getRepository(KoraBatch).count();

  beforeAll(async () => {
    ctx = await createTestApp([KoraModule]);
  }, 50000);

  beforeEach(async () => {
    prefix = randomUUID().slice(0, 8);
    await setKoraProjectStatus(ctx, KoraProjectStatus.Pending);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("stores a valid upload, lists it, and lets the project become active", async () => {
    const res = await upload({
      transcripts: koraPairsFile(
        koraPair(`${prefix}-1`),
        koraPair(`${prefix}-2`),
      ),
    }).expect(201);

    expect(res.body).toMatchObject({
      transcriptCount: 2,
      transcriptsPerAssignment: 10,
      reviewsPerTranscript: 3,
    });
    const listed = await asAdmin("get", "/kora/admin/batches").expect(200);
    expect(listed.body[0]).toMatchObject({
      id: res.body.id,
      transcriptCount: 2,
    });
    expect(
      (await asAdmin("get", "/kora/admin/project").expect(200)).body
        .canActivate,
    ).toBe(true);
    await asAdmin("put", "/kora/admin/project")
      .send({ status: KoraProjectStatus.Active })
      .expect(200);

    const preview = await asAdmin(
      "get",
      `/kora/admin/batches/${res.body.id}/random-transcript`,
    ).expect(200);
    expect([`${prefix}-1`, `${prefix}-2`]).toContain(
      preview.body.transcript.transcriptId,
    );
    expect(preview.body.contentHash).toMatch(/^sha256:/);
  });

  it("rejects the whole file, listing each bad line, and stores nothing", async () => {
    const before = await batchCount();
    const res = await upload({
      transcripts: [
        JSON.stringify(koraPair(`${prefix}-ok`)),
        JSON.stringify(koraPair(`${prefix}-bad`, { risk_id: "nope" })),
        "{oops",
      ].join("\n"),
    }).expect(400);

    expect(res.body.message).toBe(
      "2 lines were rejected, so nothing was uploaded.",
    );
    expect(res.body.rejected.map((r: { line: number }) => r.line)).toEqual([
      2, 3,
    ]);
    expect(await batchCount()).toBe(before);
  });

  it("rejects a transcript id uploaded in an earlier batch", async () => {
    await upload({
      transcripts: koraPairsFile(koraPair(`${prefix}-once`)),
    }).expect(201);

    const res = await upload({
      transcripts: koraPairsFile(koraPair(`${prefix}-once`)),
    }).expect(400);

    expect(res.body.rejected[0].problems).toEqual([
      `transcript ${prefix}-once was already uploaded in an earlier batch`,
    ]);
  });

  it("asks for the transcripts file", async () => {
    const res = await upload({}).expect(400);
    expect(res.body.message).toBe(KORA_UPLOAD_NEEDS_TRANSCRIPTS);
  });

  it("refuses a file in a field it doesn't take", async () => {
    await upload({ transcripts: koraPairsFile(koraPair(`${prefix}-1`)) })
      .attach("exportSchema", Buffer.from("{}"), "export.schema.json")
      .expect(400);
  });

  it("keeps uploads and previews from non-admins, and 404s an unknown batch", async () => {
    await upload({
      transcripts: koraPairsFile(koraPair(`${prefix}-1`)),
      token: ctx.accessToken,
    }).expect(401);
    await asAdmin(
      "get",
      `/kora/admin/batches/${randomUUID()}/random-transcript`,
    ).expect(404);
  });
});
