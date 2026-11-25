import { href } from "react-router";
import { PlaceId, placeById, tabHref } from "../../places";

export const VIDEOS_HREF = tabHref(placeById(PlaceId.Media), { tab: "videos" });

export const videoHref = (videoId: number): string =>
  href("/content/media/videos/:videoId", { videoId: String(videoId) });

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** A file size in the largest unit that keeps it at or above one: "2.0 KB". */
export function formatSize(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

/** What is wrong with the files chosen to replace a video's content, if anything. */
export function replacementFilesError(files: readonly File[]): string | null {
  if (files.length === 0) return "Choose the playlist and its segment files";
  if (!files.some((file) => file.name.endsWith(".m3u8")))
    return "At least one .m3u8 playlist file is required";
  return null;
}
