import { videosGetVideoDetailsAdmin } from "@alliance/shared/client";
import type { VideoDetailResponseDto } from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import VideoPlayer from "@alliance/sharedweb/forms/VideoPlayer";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import VideoReplaceForm from "../components/VideoReplaceForm";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VideoDetail: React.FC = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoDetailResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const { error: pushError } = useToast();

  const loadVideo = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    try {
      const response = await videosGetVideoDetailsAdmin({
        path: { id: Number(videoId) },
      });
      setVideo(response.data ?? null);
    } catch (err) {
      console.error("Failed to load video details", err);
      pushError("Failed to load video details");
    } finally {
      setLoading(false);
    }
  }, [videoId, pushError]);

  useEffect(() => {
    void loadVideo();
  }, [loadVideo]);

  if (loading) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-zinc-500">Loading video details...</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-red-500">Video not found.</p>
      </div>
    );
  }

  const { processingInfo } = video;
  const hasProcessingInfo = processingInfo != null;

  return (
    <div className="bg-white min-h-screen">
      <div className="p-6 pt-10 flex flex-col gap-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <Button
            color={ButtonColor.Transparent}
            onClick={() => navigate("/videos")}
            className="!px-2"
          >
            &larr; Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{video.originalFilename}</h1>
            <p className="text-sm text-zinc-500">Video ID: {video.id}</p>
          </div>
        </div>

        <VideoPlayer src="" videoId={video.id} />

        {/* Video Info */}
        <Card style={CardStyle.White}>
          <h2 className="font-semibold text-lg mb-3">Video Info</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-zinc-500">Original Size</dt>
            <dd>{formatSize(video.size)}</dd>
            <dt className="text-zinc-500">Output Size</dt>
            <dd>{formatSize(video.totalOutputSize)}</dd>
            <dt className="text-zinc-500">Duration</dt>
            <dd>{formatDuration(video.duration)}</dd>
            <dt className="text-zinc-500">MIME Type</dt>
            <dd>{video.mime}</dd>
            <dt className="text-zinc-500">Created</dt>
            <dd>{new Date(video.dateCreated).toLocaleString()}</dd>
            <dt className="text-zinc-500">Updated</dt>
            <dd>{new Date(video.dateUpdated).toLocaleString()}</dd>
          </dl>
        </Card>

        {/* Processing Settings */}
        <Card style={CardStyle.White}>
          <h2 className="font-semibold text-lg mb-3">Processing Settings</h2>
          {hasProcessingInfo ? (
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-zinc-500">Codec:</span>{" "}
                {processingInfo.codec}
              </div>
              <div>
                <span className="text-zinc-500">Preset:</span>{" "}
                {processingInfo.preset}
              </div>
              <div>
                <span className="text-zinc-500">CRF:</span> {processingInfo.crf}
              </div>
              <div>
                <span className="text-zinc-500">Max Rate:</span>{" "}
                {processingInfo.maxrate}
              </div>
              <div>
                <span className="text-zinc-500">Buffer Size:</span>{" "}
                {processingInfo.bufsize}
              </div>
              <div>
                <span className="text-zinc-500">Scale:</span>{" "}
                {processingInfo.scale}
              </div>
              <div>
                <span className="text-zinc-500">Audio Codec:</span>{" "}
                {processingInfo.audioCodec}
              </div>
              <div>
                <span className="text-zinc-500">Audio Bitrate:</span>{" "}
                {processingInfo.audioBitrate}
              </div>
              <div>
                <span className="text-zinc-500">HLS Segment Duration:</span>{" "}
                {processingInfo.hlsTime}s
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Processing info not found.</p>
          )}
        </Card>

        {/* HLS Segments */}
        <Card style={CardStyle.White}>
          <h2 className="font-semibold text-lg mb-3">HLS Segments</h2>
          {video.segments.length === 0 ? (
            <p className="text-sm text-zinc-500">No segments found.</p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto border rounded">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 uppercase border-b sticky top-0 bg-white">
                    <tr>
                      <th className="py-2 px-3">Filename</th>
                      <th className="py-2 px-3 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {video.segments.map((seg) => (
                      <tr key={seg.key} className="border-b last:border-0">
                        <td className="py-2 px-3 font-mono text-xs">
                          {seg.filename}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatSize(seg.size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-2 text-sm">
                {/* <span className="text-zinc-500">
                  {video.segments.length} segment
                  {video.segments.length !== 1 ? "s" : ""}
                </span> */}
                <span className="font-medium">
                  Total: {formatSize(video.totalOutputSize)}
                </span>
              </div>
            </>
          )}
        </Card>

        {/* Replace Video Content */}
        <Card style={CardStyle.White} className="space-y-3">
          <h2 className="font-semibold text-lg">Replace Video Content</h2>
          <p>process the video manually with a command like:</p>
          <code className="text-xs bg-zinc-100 p-2 rounded-md block w-full overflow-x-auto">
            ffmpeg -i input.mp4 -c:v libx264 -preset fast -crf 28 -maxrate 2M
            -bufsize 4M -vf scale=-2:720 -c:a aac -b:a 128k -hls_time 6
            -hls_list_size 0 -hls_segment_filename segment_%03d.ts output.m3u8
          </code>
          <VideoReplaceForm videoId={video.id} onComplete={loadVideo} />
        </Card>
      </div>
    </div>
  );
};

export default VideoDetail;
