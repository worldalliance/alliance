import { activityById } from "../content";
import { POST_CARD_WIDTH, PostCard, ScaledCard } from "./PostCard";

/**
 * Landing 6. Three cards in a row beside the headline, each larger than the one
 * before it, so the group reads as a feed running off the right of the page
 * rather than a scatter. Photo, text, photo, so the types alternate.
 */
const CARDS = [
  { id: "cup-coverage", height: 370, scale: 0.55 },
  { id: "chatbot-completion", height: 350, scale: 0.63 },
  { id: "ewaste-collection", height: 440, scale: 0.74 },
];

const GAP = 18;

export function PostCollage({ className }: { className?: string }) {
  return (
    <div className={className} aria-label="Recent member activity">
      <div className="hidden items-center lg:flex" style={{ gap: GAP }}>
        {CARDS.map((card) => (
          <ScaledCard
            key={card.id}
            width={POST_CARD_WIDTH}
            height={card.height}
            scale={card.scale}
          >
            <PostCard item={activityById(card.id)} />
          </ScaledCard>
        ))}
      </div>

      {/* No room for the row below lg, so one card stands in for the group. */}
      <ScaledCard
        width={POST_CARD_WIDTH}
        height={340}
        scale={0.78}
        className="lg:hidden"
      >
        <PostCard item={activityById("cup-coverage")} />
      </ScaledCard>
    </div>
  );
}
