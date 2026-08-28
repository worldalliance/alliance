import { cn } from "@alliance/shared/styles/util";
import { activityById } from "../content";
import { POST_CARD_WIDTH, PostCard, ScaledCard } from "./PostCard";

/**
 * Landing 5. A single row running the full width of the page and off both
 * edges, so it reads as a slice of a feed that carries on past the frame. The
 * three card types alternate, and the heights and offsets vary the way a real
 * column of activity would.
 */
const ROW = [
  { id: "pothole-completion", height: 280, offsetY: 10 },
  { id: "cup-coverage", height: 400, offsetY: 26 },
  { id: "chatbot-comment", height: 216, offsetY: 92 },
  { id: "chatbot-transcripts", height: 330, offsetY: 8 },
  { id: "chatbot-completion", height: 300, offsetY: 48 },
  { id: "ewaste-collection", height: 310, offsetY: 0 },
  { id: "cup-comment", height: 196, offsetY: 78 },
  { id: "federal-dockets", height: 320, offsetY: 22 },
];

const SCALE = 0.74;
const GAP = 58;

/** Puts the first card half off the left edge, as in the reference. */
const LEAD_IN = -150;

export function PostMarquee({ className }: { className?: string }) {
  return (
    <div
      className={cn("w-full overflow-hidden", className)}
      aria-label="Recent member activity"
    >
      <div
        className="flex items-start"
        style={{ gap: GAP, marginLeft: LEAD_IN }}
      >
        {ROW.map((card) => (
          <ScaledCard
            key={card.id}
            width={POST_CARD_WIDTH}
            height={card.height}
            scale={SCALE}
            style={{ marginTop: card.offsetY }}
          >
            <PostCard item={activityById(card.id)} />
          </ScaledCard>
        ))}
      </div>
    </div>
  );
}
