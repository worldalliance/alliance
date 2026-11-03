import { prefersReducedMotion } from "@alliance/sharedweb/lib/reducedMotion";
import { Play } from "lucide-react";
import { useRef, useState } from "react";
import { REVIEW_DEMO } from "./copy";

export function ReviewDemoVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  return (
    <div className="relative w-[min(100%,30rem)] shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <video
        ref={video}
        src={REVIEW_DEMO.src}
        poster={REVIEW_DEMO.poster}
        aria-label={REVIEW_DEMO.label}
        autoPlay={playing}
        muted
        loop
        playsInline
        className="block h-auto w-full"
      />
      {!playing && (
        <button
          type="button"
          aria-label="Play demo"
          title="Play demo"
          onClick={() => {
            setPlaying(true);
            void video.current?.play();
          }}
          className="absolute inset-0 grid place-items-center bg-black/10"
        >
          <Play className="size-14 rounded-full bg-black/70 p-3.5 text-white" />
        </button>
      )}
    </div>
  );
}
