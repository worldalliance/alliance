import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
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
    // As main.ts sets it, so X-Forwarded-For names the requester.
    ctx.app.getHttpAdapter().getInstance().set("trust proxy", "loopback");

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

  describe("GET /images/:key/download", () => {
    const key = "123.webp";

    function storeObject(bytes: Buffer) {
      mockSend.mockImplementationOnce(async () => ({
        Body: { transformToByteArray: async () => new Uint8Array(bytes) },
      }));
    }

    async function transparentWebp(): Promise<Buffer> {
      return sharp({
        create: {
          width: 2,
          height: 2,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .webp()
        .toBuffer();
    }

    it("returns the image as a jpeg flattened onto white", async () => {
      storeObject(await transparentWebp());
      const res = await request(ctx.app.getHttpServer())
        .get(`/images/${key}/download?name=Poster.jpg`)
        .expect(200)
        .expect("Content-Type", "image/jpeg")
        .expect("Content-Disposition", "attachment; filename=Poster.jpg");

      const { data } = await sharp(res.body)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([...data.subarray(0, 3)]).toEqual([255, 255, 255]);
    });

    it("names an accented file with an ascii fallback and filename*", async () => {
      storeObject(await transparentWebp());
      await request(ctx.app.getHttpServer())
        .get(`/images/${key}/download?name=${encodeURIComponent("Café")}`)
        .expect(200)
        .expect(
          "Content-Disposition",
          `attachment; filename="Caf?.jpg"; filename*=UTF-8''Caf%C3%A9.jpg`,
        );
    });

    it("answers 404 for a missing object", async () => {
      mockSend.mockImplementationOnce(async () => {
        throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      });
      await request(ctx.app.getHttpServer())
        .get(`/images/${key}/download`)
        .expect(404);
    });

    it("answers 404 for an object the bucket refuses", async () => {
      mockSend.mockImplementationOnce(async () => {
        throw Object.assign(new Error("denied"), { name: "AccessDenied" });
      });
      await request(ctx.app.getHttpServer())
        .get(`/images/${key}/download`)
        .expect(404);
    });

    it("answers 404 for an object that is not an image", async () => {
      storeObject(Buffer.from("hello"));
      await request(ctx.app.getHttpServer())
        .get(`/images/${key}/download`)
        .expect(404);
    });

    it("answers 413 for an image past the pixel cap", async () => {
      storeObject(
        await sharp({
          create: {
            width: 11000,
            height: 11000,
            channels: 3,
            background: "#fff",
          },
        })
          .png({ compressionLevel: 1 })
          .toBuffer(),
      );
      await request(ctx.app.getHttpServer())
        .get(`/images/${key}/download`)
        .expect(413);
    });

    async function holdObjects() {
      const bytes = await transparentWebp();
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      const original = mockSend.getMockImplementation();
      mockSend.mockImplementation(async () => {
        await held;
        return {
          Body: { transformToByteArray: async () => new Uint8Array(bytes) },
        };
      });
      return { release, restore: () => mockSend.mockImplementation(original) };
    }

    const downloadFrom = (ip: string) =>
      request(ctx.app.getHttpServer())
        .get(`/images/${key}/download`)
        .set("X-Forwarded-For", ip);

    it("converts one at a time and sheds a full queue with a 503", async () => {
      const { release, restore } = await holdObjects();
      try {
        const statuses = Array.from({ length: 22 }, (_, n) =>
          downloadFrom(`10.0.0.${n}`).then((res) => res.status),
        );

        expect(await Promise.race(statuses)).toBe(503);
        expect(mockSend).toHaveBeenCalledTimes(1);
        release();
        const settled = await Promise.all(statuses);
        expect(settled.filter((status) => status === 200)).toHaveLength(21);
        expect(settled.filter((status) => status === 503)).toHaveLength(1);
      } finally {
        restore();
      }
    });

    it("holds two places in the queue per requester", async () => {
      const { release, restore } = await holdObjects();
      try {
        const statuses = Array.from({ length: 3 }, () =>
          downloadFrom("10.0.1.1").then((res) => res.status),
        );

        expect(await Promise.race(statuses)).toBe(429);
        release();
        expect((await Promise.all(statuses)).sort()).toEqual([200, 200, 429]);
      } finally {
        restore();
      }
    });

    it("skips the conversion for a client that left while queued", async () => {
      const { release, restore } = await holdObjects();
      try {
        const first = downloadFrom("10.0.2.1").then((res) => res.status);
        await downloadFrom("10.0.2.2")
          .timeout(200)
          .catch(() => {});

        release();
        expect(await first).toBe(200);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(mockSend).toHaveBeenCalledTimes(1);
      } finally {
        restore();
      }
    });

    it("answers 404 for a key that names no upload", async () => {
      await request(ctx.app.getHttpServer())
        .get(`/images/${encodeURIComponent("a:b")}/download`)
        .expect(404);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
