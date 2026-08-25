import { Readable } from "stream";
import request from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Repository } from "typeorm";
import { Video } from "../src/videos/entities/video.entity";
import { VideosModule } from "../src/videos/videos.module";

describe("Videos (e2e)", () => {
  let ctx: TestContext;
  let videoRepo: Repository<Video>;
  let mockSend: jest.Mock;

  beforeAll(async () => {
    process.env.ASSETS_BUCKET = "test-bucket";
    ctx = await createTestApp([VideosModule]);
    videoRepo = ctx.dataSource.getRepository(Video);

    const s3 = ctx.app.get<S3Client>("S3_CLIENT");
    mockSend = jest.fn(async (command) => {
      if (command instanceof GetObjectCommand) {
        return {
          Body: Readable.from(Buffer.from("mock-video-bytes")),
          ContentType: "video/MP2T",
        };
      }
      // For PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand
      return { Contents: [] };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s3 as any).send = mockSend;
  }, 50000);

  afterEach(async () => {
    await videoRepo.query("DELETE FROM video");
    mockSend.mockClear();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("uploads a video", async () => {
    const response = await request(ctx.app.getHttpServer())
      .post("/videos/upload")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .attach("files", Buffer.from("fake-video-data"), {
        filename: "test.mp4",
        contentType: "video/mp4",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(Number),
      key: expect.stringContaining("videos/"),
    });
  });

  it("streams HLS files from S3", async () => {
    const video = await videoRepo.save(
      videoRepo.create({
        key: "videos/test-stream",
        originalFilename: "test.mp4",
        mime: "video/mp4",
        size: 1000,
      }),
    );

    await request(ctx.app.getHttpServer())
      .get(`/videos/${video.id}/playlist.m3u8`)
      .expect(200);

    expect(mockSend).toHaveBeenCalledWith(
      expect.any(GetObjectCommand),
      expect.anything(),
    );
  });

  it("returns 404 when streaming a file for a non-existent video", async () => {
    await request(ctx.app.getHttpServer())
      .get("/videos/99999/playlist.m3u8")
      .expect(404);
  });

  it("deletes a video", async () => {
    const video = await videoRepo.save(
      videoRepo.create({
        key: "videos/test-delete",
        originalFilename: "test.mp4",
        mime: "video/mp4",
        size: 1000,
      }),
    );

    await request(ctx.app.getHttpServer())
      .delete(`/videos/${video.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.deleted).toBe(true);
      });

    const deleted = await videoRepo.findOneBy({ id: video.id });
    expect(deleted).toBeNull();
  });

  it("returns 404 when deleting a non-existent video", async () => {
    await request(ctx.app.getHttpServer())
      .delete("/videos/99999")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
  });

  it("rejects upload without admin token", async () => {
    await request(ctx.app.getHttpServer())
      .post("/videos/upload")
      .attach("files", Buffer.from("fake-video-data"), {
        filename: "test.mp4",
        contentType: "video/mp4",
      })
      .expect(401);
  });

  it("lists videos as admin", async () => {
    await videoRepo.save(
      videoRepo.create({
        key: "videos/test-list-1",
        originalFilename: "one.mp4",
        mime: "video/mp4",
        size: 1000,
      }),
    );
    await videoRepo.save(
      videoRepo.create({
        key: "videos/test-list-2",
        originalFilename: "two.mp4",
        mime: "video/mp4",
        size: 2000,
      }),
    );

    const response = await request(ctx.app.getHttpServer())
      .get("/videos")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(response.body.videos).toHaveLength(2);
    expect(response.body.videos[0]).toHaveProperty("id");
    expect(response.body.videos[0]).toHaveProperty("originalFilename");
    expect(response.body.videos[0]).toHaveProperty("dateCreated");
  });

  it("rejects list without auth", async () => {
    await request(ctx.app.getHttpServer()).get("/videos").expect(401);
  });

  it("gets video details with segments", async () => {
    const video = await videoRepo.save(
      videoRepo.create({
        key: "videos/test-details",
        originalFilename: "detail.mp4",
        mime: "video/mp4",
        size: 5000,
        duration: 30.0,
        processingInfo: {
          codec: "libx264",
          preset: "fast",
          crf: 28,
          maxrate: "2M",
          bufsize: "4M",
          scale: "-2:720",
          audioCodec: "aac",
          audioBitrate: "128k",
          hlsTime: 6,
        },
      }),
    );

    // Override mock to return segment data for ListObjectsV2Command
    mockSend.mockImplementation(async (command) => {
      if (command instanceof GetObjectCommand) {
        return {
          Body: Readable.from(Buffer.from("mock-video-bytes")),
          ContentType: "video/MP2T",
        };
      }
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [
            { Key: `${video.key}/playlist.m3u8`, Size: 200 },
            { Key: `${video.key}/segment_000.ts`, Size: 50000 },
            { Key: `${video.key}/segment_001.ts`, Size: 48000 },
          ],
        };
      }
      return { Contents: [] };
    });

    const response = await request(ctx.app.getHttpServer())
      .get(`/videos/${video.id}/details`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: video.id,
      originalFilename: "detail.mp4",
      duration: 30.0,
    });
    expect(response.body.segments).toHaveLength(3);
    expect(response.body.segments[0]).toHaveProperty("filename");
    expect(response.body.segments[0]).toHaveProperty("size");
    expect(response.body.totalOutputSize).toBe(98200);
    expect(response.body.processingInfo).toHaveProperty("codec");
    expect(response.body.processingInfo.codec).toBe("libx264");
  });

  it("returns 404 for non-existent video details", async () => {
    await request(ctx.app.getHttpServer())
      .get("/videos/99999/details")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
  });

  it("replaces video content", async () => {
    const video = await videoRepo.save(
      videoRepo.create({
        key: "videos/test-replace",
        originalFilename: "replace.mp4",
        mime: "video/mp4",
        size: 3000,
      }),
    );

    mockSend.mockImplementation(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [{ Key: `${video.key}/playlist.m3u8`, Size: 200 }],
        };
      }
      if (command instanceof PutObjectCommand) {
        return {};
      }
      return {};
    });

    const response = await request(ctx.app.getHttpServer())
      .post(`/videos/${video.id}/replace`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .attach("files", Buffer.from("fake-m3u8"), {
        filename: "playlist.m3u8",
        contentType: "application/vnd.apple.mpegurl",
      })
      .attach("files", Buffer.from("fake-segment"), {
        filename: "segment_000.ts",
        contentType: "video/MP2T",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: video.id,
      key: video.key,
    });
  });
});
