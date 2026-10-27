import { devPorts, PortCaller } from "@alliance/common/dev-ports";
import {
  IMAGE_CACHE_CONTROL,
  isUploadKey,
  THUMBNAIL_WIDTH,
  thumbnailKey,
  uploadKeyInUrl,
} from "@alliance/common/image-src";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import convert from "heic-convert";
import sharp from "sharp";
import { AsyncSemaphore } from "src/utils/async-semaphore";

// A 108 MP phone photo fits; a small file with huge dimensions doesn't.
const DOWNLOAD_MAX_PIXELS = 120_000_000;
// A conversion near the pixel cap holds over a gigabyte while it runs.
const MAX_CONCURRENT_CONVERSIONS = 1;
const MAX_QUEUED_CONVERSIONS = 20;
// The queue is first in, first out, so a cap per requester keeps one from
// filling it; two leaves room for a household behind one address.
const MAX_CONVERSIONS_PER_REQUESTER = 2;

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(@Inject("S3_CLIENT") private readonly s3: S3Client) {}

  private readonly bucket = process.env.ASSETS_BUCKET!; // TODO: separate dev bucket

  /**
   * The timestamp keeps keys roughly ordered; the uuid is what makes them
   * unique, since two uploads can land in the same millisecond and one would
   * otherwise overwrite the other.
   */
  private newImageKey(): string {
    return `${Date.now()}-${randomUUID()}.webp`;
  }

  /** Returns a buffer suitable for sharp (HEIC/HEIF converted to JPEG). */
  private async normalizeToSharpBuffer(file: string): Promise<Buffer> {
    const commaIdx = file.indexOf(",");
    if (commaIdx === -1) {
      throw new BadRequestException("Invalid image data URI");
    }
    const prefix = file.substring(0, commaIdx).toLowerCase();
    const spliced = file.substring(commaIdx + 1);
    const imgBuffer = Buffer.from(spliced, "base64");
    if (prefix.includes("heic") || prefix.includes("heif")) {
      return (await convert({
        buffer: imgBuffer,
        format: "JPEG",
        quality: 0.9,
      })) as Buffer;
    }
    return imgBuffer;
  }

  private async putImage(key: string, body: Buffer): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: IMAGE_CACHE_CONTROL,
      }),
    );
  }

  private readonly conversions = new AsyncSemaphore(
    MAX_CONCURRENT_CONVERSIONS,
    MAX_QUEUED_CONVERSIONS,
  );
  private readonly conversionsByRequester = new Map<string, number>();

  /**
   * Any object it can't read as an image is not found, as in pipeS3Object.
   * Undefined when the client left before its turn, which skips the work.
   */
  async jpegDownload(params: {
    key: string;
    requester: string;
    clientGone: () => boolean;
  }): Promise<Buffer | undefined> {
    const { key, requester, clientGone } = params;
    const held = this.conversionsByRequester.get(requester) ?? 0;
    if (held >= MAX_CONVERSIONS_PER_REQUESTER) {
      throw new HttpException(
        "Wait for your other image downloads to finish, then try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.conversionsByRequester.set(requester, held + 1);
    try {
      const converted = await this.conversions.run(async () =>
        clientGone() ? undefined : this.toJpeg(key),
      );
      if (!converted.ok) {
        throw new ServiceUnavailableException(
          "Too many image downloads at once. Try again in a moment.",
        );
      }
      return converted.value;
    } finally {
      const left = (this.conversionsByRequester.get(requester) ?? 1) - 1;
      if (left > 0) this.conversionsByRequester.set(requester, left);
      else this.conversionsByRequester.delete(requester);
    }
  }

  private async toJpeg(key: string): Promise<Buffer> {
    try {
      const object = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!object.Body) throw new NotFoundException();
      const bytes = await object.Body.transformToByteArray();
      const { width = 0, height = 0 } = await sharp(bytes).metadata();
      if (width * height > DOWNLOAD_MAX_PIXELS) {
        throw new PayloadTooLargeException(
          "This image is too large to download as a jpeg.",
        );
      }
      // JPEG has no alpha channel, and sharp fills transparency with black.
      return await sharp(bytes, { limitInputPixels: DOWNLOAD_MAX_PIXELS })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (err) {
      if (err instanceof PayloadTooLargeException) throw err;
      if (!(err instanceof NotFoundException) && err?.name !== "NoSuchKey") {
        this.logger.warn(`Failed to convert ${JSON.stringify(key)}: ${err}`);
      }
      throw new NotFoundException();
    }
  }

  async processAndUploadProfileImage(image: string): Promise<string> {
    const imgBuffer = await this.normalizeToSharpBuffer(image);
    const [processed, thumbnail] = await Promise.all([
      sharp(imgBuffer)
        .rotate()
        .resize({ width: 400 })
        .webp({ effort: 3 })
        .toBuffer(),
      sharp(imgBuffer)
        .rotate()
        .resize({ width: THUMBNAIL_WIDTH })
        .webp({ effort: 3 })
        .toBuffer(),
    ]);

    const key = this.newImageKey();

    await Promise.all([
      this.putImage(key, processed),
      this.putImage(thumbnailKey(key), thumbnail),
    ]);

    return key;
  }

  /**
   * A data uri uploads, null clears, and undefined leaves the column alone. The
   * api renders a stored photo as a url, so a client that sends one back has it
   * ignored rather than overwriting the upload key.
   */
  async resolvePhotoUpdate(
    photo: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (photo === undefined || photo === null) {
      return photo;
    }
    if (photo.startsWith("data:")) {
      return this.processAndUploadProfileImage(photo);
    }
    this.logger.warn(
      `Ignored a photo that is neither a data uri nor null: ${photo.slice(0, 100)}`,
    );
    return undefined;
  }

  async uploadImage(
    file: string,
    resize?: { width: number; height: number },
  ): Promise<string> {
    const imgBuffer = await this.normalizeToSharpBuffer(file);
    let processed = await sharp(imgBuffer).rotate().webp({ effort: 3 });

    if (resize) {
      processed = await processed.resize(resize.width, resize.height, {
        fit: "inside",
      });
    }
    try {
      const buffer = await processed.toBuffer();

      const key = this.newImageKey();
      await this.putImage(key, buffer);
      return key;
    } catch {
      throw new BadRequestException(
        "Failed to process image - try a standard image format",
      );
    }
  }
}

export function getImageSource(string: string) {
  if (typeof string !== "string") {
    return "";
  }

  if (!isUploadKey(string)) {
    return string;
  }

  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "staging"
  ) {
    if (
      process.env.USE_CLOUDFRONT === "true" &&
      process.env.CLOUDFRONT_DOMAIN
    ) {
      return `https://${process.env.CLOUDFRONT_DOMAIN}/${string}`;
    }
    return `${process.env.APP_URL}/api/images/${string}`;
  } else {
    return `http://localhost:${devPorts(PortCaller.Server).server}/images/${string}`;
  }
}

/**
 * The upload key a url names, when this api rendered it. A url an admin typed
 * can end in a key-shaped filename, so the candidate only counts if it renders
 * back to the url it came from.
 */
export function renderedImageKey(src: string): string | undefined {
  const key = uploadKeyInUrl(src);
  return key && getImageSource(key) === src ? key : undefined;
}
