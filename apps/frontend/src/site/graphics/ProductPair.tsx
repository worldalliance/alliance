import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
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
 * Phone column: the opened post overlaps most of the feed. The wide offset
 * would scale the type below 8px or clip the update off the right edge.
 */
const COMPACT_DETAIL_X = 80;
const COMPACT_DETAIL_Y = 84;

const COMPACT_STAGE_WIDTH = COMPACT_DETAIL_X + DETAIL_WIDTH;
const COMPACT_STAGE_HEIGHT = COMPACT_DETAIL_Y + DETAIL_HEIGHT;

function ScaledStage({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div
      className="relative"
      style={{ height: `calc(100cqi * ${height} / ${width})` }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width,
          height,
          transform: `scale(calc(100cqi / ${width}px))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Pair({ offsetX, offsetY }: { offsetX: number; offsetY: number }) {
  return (
    <>
      <div
        className="absolute top-0 left-0"
        style={{ width: FEED_WIDTH, height: FEED_HEIGHT }}
      >
        <FeedCard />
      </div>
      <div
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: DETAIL_WIDTH,
          height: DETAIL_HEIGHT,
        }}
      >
        <PostDetailCard />
      </div>
    </>
  );
}

/**
 * The feed and an opened post, laid out at full size on a stage that is scaled
 * as a unit, so the offset between them holds as the column changes width.
 */
export function ProductPair({ className }: { className?: string }) {
  return (
    <div
      className={cn("min-w-0 w-full", className)}
      aria-label="Recent member activity"
    >
      <div
        className="hidden w-full @container md:block"
        style={{ maxWidth: STAGE_WIDTH }}
      >
        <ScaledStage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
          <Pair offsetX={DETAIL_X} offsetY={DETAIL_Y} />
        </ScaledStage>
      </div>
      <div
        className="w-full @container md:hidden"
        style={{ maxWidth: COMPACT_STAGE_WIDTH }}
      >
        <ScaledStage width={COMPACT_STAGE_WIDTH} height={COMPACT_STAGE_HEIGHT}>
          <Pair offsetX={COMPACT_DETAIL_X} offsetY={COMPACT_DETAIL_Y} />
        </ScaledStage>
      </div>
    </div>
  );
}
