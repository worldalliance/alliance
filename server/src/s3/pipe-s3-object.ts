import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import { basename } from "path";
import { Readable } from "stream";

export async function pipeS3Object(params: {
  s3: S3Client;
  bucket: string;
  key: string;
  res: Response;
  contentType?: string;
}): Promise<void> {
  const { s3, bucket, key, res } = params;
  const ac = new AbortController();

  res.on("close", () => ac.abort());
  res.on("error", () => ac.abort());

  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: ac.signal },
    );

    const body = out.Body as Readable | undefined;
    if (!body) throw new NotFoundException();

    res.setHeader(
      "Content-Type",
      params.contentType ?? out.ContentType ?? "application/octet-stream",
    );
    res.setHeader("Content-Disposition", `inline; filename="${basename(key)}"`);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    body.on("error", () => {
      try {
        body.destroy();
      } catch {}
      if (!res.headersSent) res.status(500);
      res.end();
    });

    body.pipe(res);
  } catch (err) {
    if (err?.name === "AbortError") return;

    if (process.env.NODE_ENV !== "development") {
      console.error("Error getting %s:", JSON.stringify(key), err);
    }
    throw new NotFoundException();
  }
}
