import { findUnsupportedVideoCodec } from "./videos.service";

function file(originalname: string, contents: string) {
  return { originalname, buffer: Buffer.from(contents, "utf8") };
}

const MASTER_10BIT = [
  "#EXTM3U",
  "#EXT-X-VERSION:6",
  '#EXT-X-STREAM-INF:BANDWIDTH=447022,CODECS="avc1.6e001e,mp4a.40.2"',
  "output.m3u8",
  "",
].join("\n");

const MASTER_8BIT = [
  "#EXTM3U",
  "#EXT-X-VERSION:6",
  '#EXT-X-STREAM-INF:BANDWIDTH=447022,CODECS="avc1.640028,mp4a.40.2"',
  "output.m3u8",
  "",
].join("\n");

describe("findUnsupportedVideoCodec", () => {
  it("flags 10-bit H.264 (High 10) master playlists", () => {
    const result = findUnsupportedVideoCodec([
      file("playlist.m3u8", MASTER_10BIT),
    ]);
    expect(result?.codec).toBe("avc1.6e001e");
    expect(result?.reason).toContain("High 10");
  });

  it("passes 8-bit H.264 (High) master playlists", () => {
    expect(
      findUnsupportedVideoCodec([file("playlist.m3u8", MASTER_8BIT)]),
    ).toBeNull();
  });

  it("passes Baseline and Main profiles", () => {
    for (const codec of ["avc1.42001e", "avc1.4d401e"]) {
      const manifest = `#EXTM3U\n#EXT-X-STREAM-INF:CODECS="${codec},mp4a.40.2"\nout.m3u8\n`;
      expect(
        findUnsupportedVideoCodec([file("playlist.m3u8", manifest)]),
      ).toBeNull();
    }
  });

  it("passes legacy dotted-decimal Baseline/Main (avc1.66.30, avc1.77.30)", () => {
    for (const codec of ["avc1.66.30", "avc1.77.30", "avc1.100.31"]) {
      const manifest = `#EXTM3U\n#EXT-X-STREAM-INF:CODECS="${codec},mp4a.40.2"\nout.m3u8\n`;
      expect(
        findUnsupportedVideoCodec([file("playlist.m3u8", manifest)]),
      ).toBeNull();
    }
  });

  it("flags legacy dotted-decimal High 10 (avc1.110.31)", () => {
    const manifest =
      '#EXTM3U\n#EXT-X-STREAM-INF:CODECS="avc1.110.31"\nout.m3u8\n';
    const result = findUnsupportedVideoCodec([file("playlist.m3u8", manifest)]);
    expect(result?.reason).toContain("High 10");
  });

  it("flags HEVC", () => {
    const manifest =
      '#EXTM3U\n#EXT-X-STREAM-INF:CODECS="hvc1.1.6.L93.B0"\nout.m3u8\n';
    const result = findUnsupportedVideoCodec([file("playlist.m3u8", manifest)]);
    expect(result?.reason).toContain("HEVC");
  });

  it("ignores non-playlist files and media playlists without CODECS", () => {
    const media = "#EXTM3U\n#EXTINF:8.0,\nsegment_000.ts\n";
    expect(
      findUnsupportedVideoCodec([
        file("segment_000.ts", "binary-ish"),
        file("playlist.m3u8", media),
      ]),
    ).toBeNull();
  });
});
