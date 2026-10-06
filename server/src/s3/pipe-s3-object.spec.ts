import { S3Client } from "@aws-sdk/client-s3";
import { NotFoundException } from "@nestjs/common";
import express from "express";
import { Readable } from "stream";
import request from "supertest";
import { pipeS3Object } from "./pipe-s3-object";

function serve(params: {
  body: Readable | undefined;
  storedType?: string;
  contentType?: string;
  maxAgeSeconds?: number;
}) {
  const s3 = new S3Client({ region: "us-west-2" });
  jest.spyOn(s3, "send").mockImplementation(async () => ({
    Body: params.body,
    ContentType: params.storedType,
    ETag: '"stored"',
    $metadata: {},
  }));
  const app = express();
  app.get("/", (_req, res) => {
    pipeS3Object({
      s3,
      bucket: "bucket",
      key: "dir/file.png",
      res,
      contentType: params.contentType,
      maxAgeSeconds: params.maxAgeSeconds,
    }).catch((err) =>
      res.status(err instanceof NotFoundException ? 404 : 500).end(),
    );
  });
  return request(app).get("/");
}

describe("pipeS3Object", () => {
  it("streams the object with its stored content type", async () => {
    const res = await serve({
      body: Readable.from([Buffer.from("png")]),
      storedType: "image/png",
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["content-disposition"]).toBe(
      'inline; filename="file.png"',
    );
    expect(res.body.toString()).toBe("png");
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.etag).toBeUndefined();
  });

  it("caches an object briefly when asked to", async () => {
    const res = await serve({
      body: Readable.from([Buffer.from("m3u8")]),
      maxAgeSeconds: 60,
    });
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(res.headers.etag).toBeUndefined();
  });

  it("prefers the caller's content type over the stored one", async () => {
    const res = await serve({
      body: Readable.from([Buffer.from("ts")]),
      storedType: "application/octet-stream",
      contentType: "video/MP2T",
    });
    expect(res.headers["content-type"]).toBe("video/MP2T");
  });

  it("answers 404 and logs when the object has no body", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await serve({ body: undefined });
    expect(res.status).toBe(404);
    expect(log).toHaveBeenCalledWith(
      "Error getting %s:",
      '"dir/file.png"',
      expect.any(NotFoundException),
    );
    log.mockRestore();
  });

  it("ends the response when the body fails mid-stream", async () => {
    const body = new Readable({
      read() {
        this.push("par");
        this.destroy(new Error("reset"));
      },
    });
    const res = await serve({ body, storedType: "image/png" });
    expect(res.status).toBe(200);
  });
});
