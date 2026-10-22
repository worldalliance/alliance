import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import { basename } from "path";
import { Readable } from "stream";

export async function pipeS3Object(params: {
  s3: S3Client;
  bucket: string;
  key: string;
  res: Response;
  contentType?: string;
  /** Short for an object rewritten under the same key. S3's ETag stays out:
   * iOS answers a 304 with an empty body (see configureApp). */
  maxAgeSeconds?: number;
  range?: string;
  filename?: string;
}): Promise<void> {
  const { s3, bucket, key, res } = params;
  const ac = new AbortController();

  res.on("close", () => ac.abort());
  res.on("error", () => ac.abort());

  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: params.range }),
      { abortSignal: ac.signal },
    );

    const body = out.Body as Readable | undefined;
    if (!body) throw new NotFoundException();

    res.setHeader(
      "Content-Type",
      params.contentType ?? out.ContentType ?? "application/octet-stream",
    );
    if (out.ContentRange) {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader("Content-Range", out.ContentRange);
    }
    if (out.ContentLength !== undefined)
      res.setHeader("Content-Length", out.ContentLength);
    if (out.AcceptRanges) res.setHeader("Accept-Ranges", out.AcceptRanges);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${params.filename ?? basename(key)}"`,
    );
    res.setHeader(
      "Cache-Control",
      params.maxAgeSeconds === undefined
        ? "public, max-age=31536000, immutable"
        : `public, max-age=${params.maxAgeSeconds}`,
    );

    // A shared cache stores a response that ends cleanly, so a failed stream
    // must not end like a complete one or carry the cache header.
    body.on("error", (err) => {
      if (process.env.NODE_ENV !== "development") {
        console.error("Error streaming %s:", JSON.stringify(key), err);
      }
      try {
        body.destroy();
      } catch {}
      if (res.headersSent) {
        res.destroy();
      } else {
        res.removeHeader("Cache-Control");
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Range");
        res.status(500).end();
      }
    });

    body.pipe(res);
  } catch (err) {
    if (err?.name === "AbortError") return;
    if (err?.name === "InvalidRange")
      throw new HttpException(
        "Range Not Satisfiable",
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );

    if (process.env.NODE_ENV !== "development") {
      console.error("Error getting %s:", JSON.stringify(key), err);
    }
    throw new NotFoundException();
  }
}
