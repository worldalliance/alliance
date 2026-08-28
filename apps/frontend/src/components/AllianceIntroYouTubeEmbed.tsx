import ReactPlayer from "react-player";

const VIDEO_ID = "fR7Upo0DlYs";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const THUMBNAIL_URL = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

export default function AllianceIntroYouTubeEmbed() {
  const title = "Alliance introduction video";

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
      <div className="absolute inset-0">
        <ReactPlayer
          src={VIDEO_URL}
          light={THUMBNAIL_URL}
          playing
          controls
          width="100%"
          height="100%"
          previewTabIndex={0}
          previewAriaLabel={`${title}. Press Enter to load the player.`}
        />
      </div>
    </div>
  );
}
