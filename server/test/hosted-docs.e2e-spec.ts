import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import request from "supertest";
import { HostedDoc } from "../src/hosted-docs/entities/hosted-doc.entity";
import { HostedDocsModule } from "../src/hosted-docs/hosted-docs.module";
import { HostedDocsService } from "../src/hosted-docs/hosted-docs.service";
import { createTestApp, eventually, type TestContext } from "./e2e-test-utils";

const PDF = Buffer.from("%PDF-1.7\nfake pdf body");

describe("Hosted docs (e2e)", () => {
  let ctx: TestContext;
  let mockSend: jest.Mock;
  const server = () => ctx.app.getHttpServer();
  const admin = () => `Bearer ${ctx.adminAccessToken}`;
  const create = (params: {
    slug: string;
    notes?: string;
    file?: Buffer;
    contentType?: string;
  }) =>
    request(server())
      .post("/hosted-docs")
      .set("Authorization", admin())
      .field("slug", params.slug)
      .field("notes", params.notes ?? "Board packet")
      .attach("file", params.file ?? PDF, {
        filename: "upload.pdf",
        contentType: params.contentType ?? "application/pdf",
      });
  const replace = (id: number) =>
    request(server())
      .post(`/hosted-docs/${id}/file`)
      .set("Authorization", admin())
      .attach("file", PDF, {
        filename: "new.pdf",
        contentType: "application/pdf",
      });
  const views = async (id: number) =>
    (await ctx.dataSource.getRepository(HostedDoc).findOneByOrFail({ id }))
      .views;
  const sent = <T>(type: new (...args: never[]) => T): T[] =>
    mockSend.mock.calls
      .map(([command]) => command)
      .filter((command): command is T => command instanceof type);

  beforeAll(async () => {
    process.env.ASSETS_BUCKET = "test-bucket";
    ctx = await createTestApp([HostedDocsModule]);
    const s3 = ctx.app.get<S3Client>("S3_CLIENT");
    mockSend = jest.fn(async (command) => {
      if (command instanceof GetObjectCommand) {
        const ranged = command.input.Range === "bytes=0-3";
        return {
          Body: Readable.from(ranged ? PDF.subarray(0, 4) : PDF),
          ContentType: "application/pdf",
          ContentLength: ranged ? 4 : PDF.length,
          ContentRange: ranged ? `bytes 0-3/${PDF.length}` : undefined,
          AcceptRanges: "bytes",
        };
      }
      return {};
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s3 as any).send = mockSend;
  }, 50000);
  beforeEach(async () => {
    await ctx.dataSource.getRepository(HostedDoc).clear();
    mockSend.mockClear();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it("restricts management to admins", async () => {
    const doc = await create({ slug: "Pilot.pdf" }).expect(201);
    for (const token of ["", ctx.accessToken]) {
      const auth = `Bearer ${token}`;
      await request(server())
        .get("/hosted-docs")
        .set("Authorization", auth)
        .expect(401);
      await request(server())
        .post("/hosted-docs")
        .set("Authorization", auth)
        .field("slug", "Other.pdf")
        .attach("file", PDF, "upload.pdf")
        .expect(401);
      await request(server())
        .patch(`/hosted-docs/${doc.body.id}`)
        .set("Authorization", auth)
        .send({ notes: "x" })
        .expect(401);
      await request(server())
        .delete(`/hosted-docs/${doc.body.id}`)
        .set("Authorization", auth)
        .expect(401);
    }
  });

  it("serves the uploaded PDF publicly with caching headers", async () => {
    const created = await create({ slug: "2026-Pilot.pdf" }).expect(201);
    expect(created.body).toMatchObject({
      slug: "2026-Pilot.pdf",
      notes: "Board packet",
      views: 0,
      uploadedByName: expect.any(String),
      fileReplacedAt: null,
      fileReplacedByName: null,
    });
    const [put] = sent(PutObjectCommand);
    expect(put.input.Key).toMatch(/^docs\/.+\.pdf$/);

    const res = await request(server()).get("/docs/2026-Pilot.pdf").expect(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe(
      'inline; filename="2026-Pilot.pdf"',
    );
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
    expect(res.headers["x-robots-tag"]).toBeUndefined();
    expect(Buffer.from(res.body)).toEqual(PDF);
    await eventually(
      () => views(created.body.id),
      (count) => count === 1,
    );

    await request(server())
      .get("/docs/2026-Pilot.pdf")
      .set("If-None-Match", res.headers.etag)
      .expect(304);
  });

  it("answers ranges with 206 and counts only reads from byte 0", async () => {
    const { body } = await create({ slug: "Pilot.pdf" }).expect(201);
    const countView = jest.spyOn(ctx.app.get(HostedDocsService), "countView");
    const first = await request(server())
      .get("/docs/Pilot.pdf")
      .set("Range", "bytes=0-3")
      .expect(206);
    expect(first.headers["content-range"]).toBe(`bytes 0-3/${PDF.length}`);
    expect(sent(GetObjectCommand)[0].input.Range).toBe("bytes=0-3");
    await request(server())
      .get("/docs/Pilot.pdf")
      .set("Range", "bytes=4-")
      .expect(200);
    expect(countView.mock.calls).toEqual([[body.id]]);
    countView.mockRestore();
  });

  it("redirects other casings to the canonical ID and treats IDs as case-insensitively unique", async () => {
    await create({ slug: "Pilot.pdf" }).expect(201);
    const res = await request(server()).get("/docs/pilot.pdf").expect(301);
    expect(res.headers.location).toBe("/docs/Pilot.pdf");
    await create({ slug: "PILOT.pdf" }).expect(409);
    expect(sent(DeleteObjectCommand)).toHaveLength(1);
  });

  it("rejects invalid IDs and files that are not PDFs", async () => {
    await create({ slug: "has space.pdf" }).expect(400);
    await create({ slug: "a.b.pdf" }).expect(400);
    await create({ slug: "ok.pdf", contentType: "image/png" }).expect(400);
    await create({
      slug: "ok.pdf",
      file: Buffer.from("not a pdf"),
    }).expect(400);
    expect(sent(PutObjectCommand)).toHaveLength(0);
  });

  it("replaces the file, keeps the views, and deletes the old object", async () => {
    const { body } = await create({ slug: "Pilot.pdf" }).expect(201);
    const oldKey = sent(PutObjectCommand)[0].input.Key;
    const before = await request(server()).get("/docs/Pilot.pdf").expect(200);
    await eventually(
      () => views(body.id),
      (count) => count === 1,
    );

    const replaced = await replace(body.id).expect(201);
    expect(replaced.body).toMatchObject({
      views: 1,
      fileReplacedAt: expect.any(String),
      fileReplacedByName: expect.any(String),
    });
    expect(sent(DeleteObjectCommand).map((c) => c.input.Key)).toEqual([oldKey]);
    const after = await request(server()).get("/docs/Pilot.pdf").expect(200);
    expect(after.headers.etag).not.toBe(before.headers.etag);
  });

  it("serves the whole file when If-Range names a replaced file", async () => {
    const { body } = await create({ slug: "Pilot.pdf" }).expect(201);
    const before = await request(server()).get("/docs/Pilot.pdf").expect(200);
    await replace(body.id).expect(201);
    mockSend.mockClear();

    const stale = await request(server())
      .get("/docs/Pilot.pdf")
      .set("Range", "bytes=0-3")
      .set("If-Range", before.headers.etag)
      .expect(200);
    expect(Buffer.from(stale.body)).toEqual(PDF);
    expect(sent(GetObjectCommand)[0].input.Range).toBeUndefined();

    await request(server())
      .get("/docs/Pilot.pdf")
      .set("Range", "bytes=0-3")
      .set("If-Range", stale.headers.etag)
      .expect(206);
  });

  it("edits notes and soft-deletes so the ID can be reused", async () => {
    const { body } = await create({ slug: "Pilot.pdf" }).expect(201);
    const patched = await request(server())
      .patch(`/hosted-docs/${body.id}`)
      .set("Authorization", admin())
      .send({ notes: "  Internal only  " })
      .expect(200);
    expect(patched.body.notes).toBe("Internal only");

    await request(server())
      .delete(`/hosted-docs/${body.id}`)
      .set("Authorization", admin())
      .expect(200);
    await request(server()).get("/docs/Pilot.pdf").expect(404);
    expect(sent(DeleteObjectCommand)).toHaveLength(0);
    await create({ slug: "pilot.pdf" }).expect(201);
  });

  it("accepts an upload with empty notes", async () => {
    const res = await create({ slug: "Pilot.pdf", notes: "" }).expect(201);
    expect(res.body.notes).toBe("");
  });

  it("returns 404 for unknown IDs", async () => {
    await request(server()).get("/docs/missing.pdf").expect(404);
  });
});
