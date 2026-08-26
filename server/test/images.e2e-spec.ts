import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import request from "supertest";
import { ImagesModule } from "../src/images/images.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Images (e2e)", () => {
  let ctx: TestContext;
  let mockSend: jest.Mock;
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

  beforeAll(async () => {
    process.env.ASSETS_BUCKET = "test-bucket";
    ctx = await createTestApp([ImagesModule]);

    const s3 = ctx.app.get<S3Client>("S3_CLIENT");
    mockSend = jest.fn(async (command) => {
      if (command instanceof GetObjectCommand) {
        return {
          Body: Readable.from(Buffer.from("mock-image-bytes")),
          ContentType: "image/webp",
        };
      }
      return {};
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s3 as any).send = mockSend;
  }, 50000);

  afterEach(() => {
    mockSend.mockClear();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  // Unauthenticated on purpose: a public form is filled by visitors who have no
  // account, and no guest token exists until they submit.
  it("uploads a base64 image and returns a served url", async () => {
    const response = await request(ctx.app.getHttpServer())
      .post("/images/uploadImage")
      .send({ file: dataUrl })
      .expect(201);

    expect(response.text || response.body).toBeDefined();
    expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
  });

  it("streams images back from the mocked S3 store", async () => {
    const key = "mock-file.webp";
    const res = await request(ctx.app.getHttpServer())
      .get(`/images/${key}`)
      .expect(200)
      .expect("Content-Type", /image\/webp/);

    expect(res.body).toBeInstanceOf(Buffer);
  });
});
