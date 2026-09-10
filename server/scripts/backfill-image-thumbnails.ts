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

type Task = {
  key: string;
  needsThumbnail: boolean;
  needsCacheControl: boolean;
};

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const item = queue.pop();
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}

async function survey(): Promise<Task[]> {
  const listed = await listImages();
  const originals = [...listed].filter((key) => !isThumbnailKey(key));
  const tasks: Task[] = [];

  await runPool(originals, async (key) => {
    tasks.push({
      key,
      needsThumbnail: !listed.has(thumbnailKey(key)),
      needsCacheControl: !(await hasCacheControl(key)),
    });
  });

  return tasks;
}

async function backfillOne({ key, needsThumbnail, needsCacheControl }: Task) {
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

  if (needsCacheControl) {
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

function preview(verb: string, keys: string[]) {
  for (const key of keys.slice(0, 10)) console.log(`  would ${verb} ${key}`);
  if (keys.length > 10) console.log(`  ...and ${keys.length - 10} more`);
}

async function main() {
  const tasks = await survey();
  const thumbnails = tasks.filter((task) => task.needsThumbnail);
  const restamps = tasks.filter((task) => task.needsCacheControl);

  console.log(`bucket ${bucket} (${region})`);
  console.log(
    `${tasks.length} images, ${thumbnails.length} without a thumbnail, ` +
      `${restamps.length} without Cache-Control`,
  );

  if (!apply) {
    console.log("\ndry run, nothing written. re-run with --apply");
    preview(
      "write",
      thumbnails.map((task) => thumbnailKey(task.key)),
    );
    preview(
      "restamp",
      restamps.map((task) => task.key),
    );
    return;
  }

  const work = tasks.filter(
    (task) => task.needsThumbnail || task.needsCacheControl,
  );
  const failures: { key: string; error: string }[] = [];
  let done = 0;

  await runPool(work, async (task) => {
    try {
      await backfillOne(task);
    } catch (error) {
      failures.push({ key: task.key, error: String(error).slice(0, 200) });
    }
    done += 1;
    if (done % 50 === 0) console.log(`${done}/${work.length}`);
  });

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
