/**
 * Generates the thumbnail that processAndUploadProfileImage now writes for
 * every image uploaded before it did, and stamps Cache-Control onto objects
 * stored without it.
 *
 * Reports what it would do and exits; pass --apply to write. Re-running is
 * safe: an object that already has a thumbnail is skipped.
 *
 * Video objects live under `videos/` in the same bucket and are rewritten
 * under their own keys, so they are left alone.
 *
 *   ASSETS_BUCKET=... AWS_REGION=... bun server/scripts/backfill-image-thumbnails.ts
 *   ASSETS_BUCKET=... AWS_REGION=... bun server/scripts/backfill-image-thumbnails.ts --apply
 */
import {
  IMAGE_CACHE_CONTROL,
  isThumbnailKey,
  THUMBNAIL_WIDTH,
  thumbnailKey,
} from "@alliance/common/image-src";
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const apply = process.argv.includes("--apply");
const bucket = process.env.ASSETS_BUCKET;
const region = process.env.AWS_REGION ?? "us-west-2";

if (!bucket) {
  console.error("ASSETS_BUCKET is required");
  process.exit(1);
}

const s3 = new S3Client({ region });
const CONCURRENCY = 8;

async function listImages(): Promise<Set<string>> {
  const found = new Set<string>();
  let token: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      const key = object.Key;
      if (key?.endsWith(".webp") && !key.includes("/")) found.add(key);
    }
    token = page.NextContinuationToken;
  } while (token);

  return found;
}

async function bodyOf(key: string): Promise<Buffer> {
  const object = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return Buffer.from(await object.Body!.transformToByteArray());
}

async function hasCacheControl(key: string): Promise<boolean> {
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );
  return head.CacheControl === IMAGE_CACHE_CONTROL;
}

async function backfillOne(key: string, needsThumbnail: boolean) {
  if (needsThumbnail) {
    const thumbnail = await sharp(await bodyOf(key))
      .resize({ width: THUMBNAIL_WIDTH })
      .webp({ effort: 3 })
      .toBuffer();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbnailKey(key),
        Body: thumbnail,
        ContentType: "image/webp",
        CacheControl: IMAGE_CACHE_CONTROL,
      }),
    );
  }

  if (!(await hasCacheControl(key))) {
    // Bucket versioning is on, so the pre-rewrite object stays recoverable.
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${bucket}/${encodeURIComponent(key)}`,
        MetadataDirective: "REPLACE",
        ContentType: "image/webp",
        CacheControl: IMAGE_CACHE_CONTROL,
      }),
    );
  }
}

async function main() {
  const listed = await listImages();
  const originals = [...listed].filter((key) => !isThumbnailKey(key));
  const missingThumbnail = originals.filter(
    (key) => !listed.has(thumbnailKey(key)),
  );

  console.log(`bucket ${bucket} (${region})`);
  console.log(
    `${originals.length} images, ${missingThumbnail.length} without a thumbnail`,
  );

  if (!apply) {
    console.log("\ndry run, nothing written. re-run with --apply");
    for (const key of missingThumbnail.slice(0, 10))
      console.log(`  would write ${thumbnailKey(key)}`);
    if (missingThumbnail.length > 10) {
      console.log(`  ...and ${missingThumbnail.length - 10} more`);
    }
    return;
  }

  const queue = [...originals];
  const failures: { key: string; error: string }[] = [];
  let done = 0;

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let key = queue.pop(); key; key = queue.pop()) {
        try {
          await backfillOne(key, !listed.has(thumbnailKey(key)));
        } catch (error) {
          failures.push({ key, error: String(error).slice(0, 200) });
        }
        done += 1;
        if (done % 50 === 0) console.log(`${done}/${originals.length}`);
      }
    }),
  );

  console.log(
    `\ndone: ${done - failures.length} ok, ${failures.length} failed`,
  );
  for (const failure of failures)
    console.error(`  ${failure.key}: ${failure.error}`);
  if (failures.length) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
