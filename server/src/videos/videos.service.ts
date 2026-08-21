import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import type { VideoDetailResponse } from "./dto/video-response.dto";
import { Video } from "./entities/video.entity";

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @Inject("S3_CLIENT") private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.ASSETS_BUCKET!;

  private contentTypeForFile(filename: string) {
    if (filename.endsWith(".m3u8")) {
      return "application/vnd.apple.mpegurl";
    } else if (filename.endsWith(".vtt")) {
      return "text/vtt";
    }
    return "video/MP2T";
  }

  private assertBroadlyPlayable(files: Express.Multer.File[]): void {
    const unsupported = findUnsupportedVideoCodec(files);
    if (unsupported) {
      throw new BadRequestException(
        `Video codec "${unsupported.codec}" (${unsupported.reason}) won't play in Firefox. ` +
          `Re-encode as 8-bit H.264 (ffmpeg -c:v libx264 -profile:v high -pix_fmt yuv420p) and re-upload.`,
      );
    }
  }

  private async putFiles(
    keyPrefix: string,
    files: Express.Multer.File[],
  ): Promise<void> {
    await Promise.all(
      files.map((file) =>
        this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: `${keyPrefix}/${file.originalname}`,
            Body: file.buffer,
            ContentType: this.contentTypeForFile(file.originalname),
          }),
        ),
      ),
    );
  }

  private async deletePrefix(keyPrefix: string): Promise<void> {
    const listResult = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${keyPrefix}/`,
      }),
    );
    const contents = listResult.Contents ?? [];
    if (contents.length === 0) return;

    await Promise.all(
      contents.map((obj) =>
        this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: obj.Key! }),
        ),
      ),
    );
  }

  async uploadVideo(files: Express.Multer.File[]): Promise<Video> {
    this.assertBroadlyPlayable(files);

    const key = `videos/${Date.now()}`;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const playlist = files.find(
      (f) =>
        f.originalname.endsWith(".m3u8") && !f.originalname.includes("_vtt"),
    );

    // Upload to S3 before persisting: a failed upload throws before any Video
    // row exists, so no phantom `ready` row points at an empty key.
    try {
      await this.putFiles(key, files);
    } catch (err) {
      this.logger.error(`Video upload to S3 failed for ${key}`, err as Error);
      // Best-effort cleanup of objects that landed before the failure.
      await this.deletePrefix(key).catch(() => undefined);
      throw err;
    }

    return this.videoRepository.save(
      this.videoRepository.create({
        key,
        originalFilename: playlist?.originalname ?? files[0].originalname,
        mime: "application/vnd.apple.mpegurl",
        size: totalSize,
        status: "ready",
        duration: null,
        processingInfo: null,
      }),
    );
  }

  async getVideo(id: number): Promise<Video | null> {
    return this.videoRepository.findOneBy({ id });
  }

  async listVideos(): Promise<Video[]> {
    return this.videoRepository.find({ order: { dateCreated: "DESC" } });
  }

  async getVideoDetails(id: number): Promise<VideoDetailResponse | null> {
    const video = await this.videoRepository.findOneBy({ id });
    if (!video) return null;

    const listResult = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${video.key}/`,
      }),
    );

    const segments = (listResult.Contents ?? []).map((obj) => ({
      filename: obj.Key!.split("/").pop()!,
      size: obj.Size ?? 0,
      key: obj.Key!,
    }));

    const totalOutputSize = segments.reduce((sum, seg) => sum + seg.size, 0);

    return { video, segments, totalOutputSize };
  }

  async replaceVideoContent(
    id: number,
    files: Express.Multer.File[],
  ): Promise<Video | null> {
    this.assertBroadlyPlayable(files);

    const video = await this.videoRepository.findOneBy({ id });
    if (!video) return null;

    // Upload replacements first, then remove stale objects — a failed replace
    // can't wipe the existing video.
    try {
      await this.putFiles(video.key, files);
    } catch (err) {
      this.logger.error(
        `Video replace upload to S3 failed for ${video.key}`,
        err as Error,
      );
      throw err;
    }

    // Delete prior-version objects the new upload didn't overwrite (same-named
    // files were already replaced by putFiles above).
    const newFilenames = new Set(files.map((f) => f.originalname));
    const listResult = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${video.key}/`,
      }),
    );
    const staleObjects = (listResult.Contents ?? []).filter(
      (obj) => !newFilenames.has(obj.Key!.split("/").pop()!),
    );
    await Promise.all(
      staleObjects.map((obj) =>
        this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: obj.Key! }),
        ),
      ),
    );

    await this.videoRepository.update(video.id, {
      status: "ready",
      processingInfo: null,
    });
    return this.videoRepository.findOneBy({ id });
  }

  async deleteVideo(id: number): Promise<boolean> {
    const video = await this.getVideo(id);
    if (!video) return false;

    await this.deletePrefix(video.key);

    await this.videoRepository.delete(id);
    return true;
  }
}

/**
 * H.264 profiles every browser decodes through Media Source Extensions (what
 * hls.js uses on Chrome/Firefox): Baseline (66), Main (77), High (100). Richer
 * profiles — High 10 (10-bit) and the 4:2:2/4:4:4 profiles — play on
 * Safari/native but fail in Firefox's MSE with a fatal "incompatible codecs".
 */
const MSE_SAFE_H264_PROFILES = new Set([66, 77, 100]);

const H264_PROFILE_NAMES: Record<number, string> = {
  88: "Extended",
  110: "High 10 (10-bit)",
  122: "High 4:2:2",
  244: "High 4:4:4",
};

/**
 * Returns why `codec` (an RFC 6381 string from an HLS `CODECS` attribute) names
 * a video codec Firefox can't decode via MSE, or `null` if it's fine or not a
 * video codec we police (audio codecs like `mp4a.40.2` are ignored).
 */
function unsupportedVideoCodecReason(codec: string): string | null {
  if (codec.startsWith("hvc1") || codec.startsWith("hev1")) {
    return "HEVC / H.265, which Firefox cannot decode";
  }
  if (codec.startsWith("avc1.")) {
    const rest = codec.slice(5);
    // Two forms exist: packed hex `avc1.PPCCLL` (e.g. avc1.640028) and the
    // legacy dotted decimal `avc1.<profile>.<level>` (e.g. avc1.66.30). Parse
    // the profile_idc according to the form so we don't read a decimal `66` as
    // hex `0x66` (= 102) and reject a Baseline stream as unplayable.
    const profileIdc = rest.includes(".")
      ? parseInt(rest.split(".")[0], 10)
      : parseInt(rest.slice(0, 2), 16);
    if (Number.isNaN(profileIdc) || MSE_SAFE_H264_PROFILES.has(profileIdc)) {
      return null;
    }
    const name = H264_PROFILE_NAMES[profileIdc] ?? `profile ${profileIdc}`;
    return `H.264 ${name}, which Firefox cannot decode`;
  }
  return null;
}

/**
 * Scan uploaded HLS playlists for a video codec Firefox can't play through
 * Media Source Extensions (e.g. 10-bit H.264). Only a master playlist's
 * `#EXT-X-STREAM-INF` line declares `CODECS`, so a bare media playlist with no
 * variant line isn't caught here — there's nothing to inspect short of demuxing
 * a segment. Returns the first offending `{ codec, reason }`, or `null`.
 */
export function findUnsupportedVideoCodec(
  files: Pick<Express.Multer.File, "originalname" | "buffer">[],
): { codec: string; reason: string } | null {
  for (const file of files) {
    if (!file.originalname.endsWith(".m3u8")) continue;
    const manifest = file.buffer.toString("utf8");
    for (const match of manifest.matchAll(/CODECS="([^"]*)"/g)) {
      for (const raw of match[1].split(",")) {
        const codec = raw.trim();
        const reason = unsupportedVideoCodecReason(codec);
        if (reason) return { codec, reason };
      }
    }
  }
  return null;
}

export function getVideoSource(key: string): string {
  // An empty/whitespace key must not become a bare-origin URL like
  // `https://<cloudfront-domain>/` — the player would then append
  // `/playlist.m3u8` and request a nonexistent bucket-root object (403).
  if (typeof key !== "string" || key.trim() === "") return "";

  if (key.startsWith("http")) return key;

  if (process.env.USE_CLOUDFRONT === "true" && process.env.CLOUDFRONT_DOMAIN) {
    return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
  }

  return key;
}
