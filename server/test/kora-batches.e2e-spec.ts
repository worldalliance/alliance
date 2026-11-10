import { KoraProjectStatus } from "@alliance/common/kora";
import { randomUUID } from "node:crypto";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraModule } from "src/kora/kora.module";
import request from "supertest";
import { createTestApp, type TestContext } from "./e2e-test-utils";
import { setKoraProjectStatus } from "./kora-fixtures";
import { EXPORT_SCHEMA_TEXT, koraPair, koraPairsFile } from "./kora-pairs";

describe("Kora transcript batches (e2e)", () => {
  let ctx: TestContext;
  let prefix: string;

  const server = () => request(ctx.app.getHttpServer());
  const upload = (params: {
    transcripts?: string;
    exportSchema?: string;
    token?: string;
  }) => {
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
    if (params.exportSchema !== undefined) {
      req = req.attach(
        "exportSchema",
        Buffer.from(params.exportSchema),
        "export.schema.json",
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
    await ctx.app.close();
  });

  it("stores a valid upload, lists it, and lets the project become active", async () => {
    const res = await upload({
      transcripts: koraPairsFile(
        koraPair(`${prefix}-1`),
        koraPair(`${prefix}-2`),
      ),
      exportSchema: EXPORT_SCHEMA_TEXT,
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
      exportSchema: EXPORT_SCHEMA_TEXT,
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
      exportSchema: EXPORT_SCHEMA_TEXT,
    }).expect(201);

    const res = await upload({
      transcripts: koraPairsFile(koraPair(`${prefix}-once`)),
      exportSchema: EXPORT_SCHEMA_TEXT,
    }).expect(400);

    expect(res.body.rejected[0].problems).toEqual([
      `transcript ${prefix}-once was already uploaded in an earlier batch`,
    ]);
  });

  it("refuses an export schema that rejects the tool's exports", async () => {
    const schema = JSON.parse(EXPORT_SCHEMA_TEXT);
    schema.properties.schemaVersion = { const: 99 };
    const res = await upload({
      transcripts: koraPairsFile(koraPair(`${prefix}-1`)),
      exportSchema: JSON.stringify(schema),
    }).expect(400);
    expect(res.body.message).toContain("rejects the review tool's exports");
  });

  it("asks for both files", async () => {
    await upload({
      transcripts: koraPairsFile(koraPair(`${prefix}-1`)),
    }).expect(400);
  });

  it("keeps uploads and previews from non-admins, and 404s an unknown batch", async () => {
    await upload({
      transcripts: koraPairsFile(koraPair(`${prefix}-1`)),
      exportSchema: EXPORT_SCHEMA_TEXT,
      token: ctx.accessToken,
    }).expect(401);
    await asAdmin(
      "get",
      `/kora/admin/batches/${randomUUID()}/random-transcript`,
    ).expect(404);
  });
});
