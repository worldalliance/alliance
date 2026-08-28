import { ScaledCard } from "./PostCard";
import {
  DETAIL_HEIGHT,
  DETAIL_WIDTH,
  FEED_HEIGHT,
  FEED_WIDTH,
  FeedCard,
  PostDetailCard,
} from "./ProductScreens";

/**
 * Where each card sits on the stage, in the cards' own pixels. The opened post
 * starts past the middle of the feed and well below it, so the two read as one
 * screen opening out of the other rather than a pair set side by side.
 */
const DETAIL_X = 318;
const DETAIL_Y = 172;

const STAGE_WIDTH = DETAIL_X + DETAIL_WIDTH;
const STAGE_HEIGHT = DETAIL_Y + DETAIL_HEIGHT;

/**
 * The feed and an opened post, laid out at full size on a stage that is scaled
 * as a unit, so the offset between them holds at every width.
 */
export function ProductPair({ className }: { className?: string }) {
  return (
    <div className={className} aria-label="Recent member activity">
      <div
        className="relative hidden [--pair-scale:0.6] lg:block xl:[--pair-scale:0.7]"
        style={{
          width: `calc(${STAGE_WIDTH}px * var(--pair-scale))`,
          height: `calc(${STAGE_HEIGHT}px * var(--pair-scale))`,
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: "scale(var(--pair-scale))",
            transformOrigin: "top left",
          }}
        >
          <div
            className="absolute top-0 left-0"
            style={{ width: FEED_WIDTH, height: FEED_HEIGHT }}
          >
            <FeedCard />
          </div>
          <div
            className="absolute"
            style={{
              left: DETAIL_X,
              top: DETAIL_Y,
              width: DETAIL_WIDTH,
              height: DETAIL_HEIGHT,
            }}
          >
            <PostDetailCard />
          </div>
        </div>
      </div>

      {/* No room to offset the pair below lg, so the feed stands in for it. */}
      <ScaledCard
        width={FEED_WIDTH}
        height={FEED_HEIGHT}
        scale={0.78}
        className="lg:hidden"
      >
        <FeedCard />
      </ScaledCard>
    </div>
  );
}
