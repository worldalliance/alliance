import { devPorts, PortCaller } from "@alliance/common/dev-ports";
import { isUploadKey, uploadKeyInUrl } from "@alliance/common/image-src";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import convert from "heic-convert";
import sharp from "sharp";

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

  async processAndUploadProfileImage(image: string): Promise<string> {
    const imgBuffer = await this.normalizeToSharpBuffer(image);
    const processed = await sharp(imgBuffer)
      .rotate()
      .resize({ width: 400 })
      .webp({ effort: 3 })
      .toBuffer();

    const key = this.newImageKey();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed,
        ContentType: "image/webp",
      }),
    );

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
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: "image/webp",
        }),
      );
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
