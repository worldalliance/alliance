import { cn } from "@alliance/shared/styles/util";
import { useState, type ReactNode } from "react";
import { MEMBER_FACES } from "../memberFaces";
import {
  ActionExampleCard,
  TimelineEntryKind,
  type ActionExample,
} from "./ActionExampleCard";

/** The action carrying an update leads, since it is the one that shows a result. */
const ACTIONS: ActionExample[] = [
  {
    id: "data-breach",
    title:
      "Check if your personal information was exposed in major data breaches",
    description:
      "Members use an online tool to find whether their personal information turned up in a known breach, and how to secure it.",
    timeline: [
      {
        kind: TimelineEntryKind.Update,
        title: "Members found 1,412 exposures across 143 accounts",
        time: "6 days ago",
        body: "We passed the patterns to a journalist at Consumer Reports, and sent members’ notes on the tool itself back to Mozilla.",
      },
      {
        kind: TimelineEntryKind.Event,
        title: "Members taking action",
        time: "23 days ago",
      },
    ],
    barAtIndex: 1,
    completed: 143,
    expected: 177,
    minutes: 15,
    faces: MEMBER_FACES,
    body: [
      {
        text: "In this action you’ll use a free online tool called Mozilla Monitor to determine whether your personal information has been leaked in a data breach and, if so, take steps to protect the compromised accounts.",
      },
      {
        heading: "Background",
        text: "A data breach occurs when personal information, such as passwords, financial information, or health records, is leaked online. Usually, breaches result from cyberattacks or data mismanagement.",
      },
    ],
  },
  {
    id: "roadless-rule",
    title:
      "Submit a public comment on the repeal of the Roadless Rule in the United States",
    description:
      "The rule protects 58 million acres of national forest from logging roads. Members comment in their own words before the period closes.",
    timeline: [
      {
        kind: TimelineEntryKind.Event,
        title: "Members taking action",
        time: "2 days ago",
      },
      {
        kind: TimelineEntryKind.Event,
        title: "Office taking action",
        time: "9 days ago",
      },
    ],
    barAtIndex: 0,
    completed: 133,
    expected: 150,
    minutes: 15,
    faces: MEMBER_FACES,
    body: [
      {
        text: "The Forest Service has opened a comment period on repealing the 2001 Roadless Rule. Comments in your own words carry more weight than a form letter, so we have drafted talking points for you to adapt rather than copy.",
      },
      {
        heading: "Talking points",
        text: "Roadless areas supply drinking water to millions of people and cost far less to maintain than roaded forest. Repealing the rule shifts that cost onto taxpayers.",
      },
    ],
  },
  {
    id: "trash-data",
    title: "Collect trash data for a citizen science project",
    description:
      "Members log what they find on one short walk, so researchers get a picture of local waste no single survey could reach.",
    timeline: [
      {
        kind: TimelineEntryKind.Event,
        title: "Results published",
        time: "5 days ago",
      },
      {
        kind: TimelineEntryKind.Event,
        title: "Members taking action",
        time: "27 days ago",
      },
    ],
    barAtIndex: 1,
    completed: 152,
    expected: 163,
    minutes: 15,
    faces: MEMBER_FACES,
    body: [
      {
        text: "Take one short walk you would have taken anyway and log every piece of litter you pass in the Marine Debris Tracker app. Fifteen minutes is enough for a usable transect.",
      },
      {
        heading: "Background",
        text: "Litter surveys are expensive to run at scale, so most of the world has never been surveyed once. Volunteer transects are what fill the gaps.",
      },
    ],
  },
];

/** Centred on the desktop row, where a middle card reads as the example. */
const ROW_ORDER = [1, 0, 2];

const CARD_WIDTH = 380;
const CARD_HEIGHT = 460;

/**
 * Scales a card from its authored pixel size by whichever axis runs out first,
 * so nothing is ever cropped at the foot. Reading `cqh` is what forces a size
 * container here rather than an inline one.
 */
function FitStage({
  width,
  height,
  className,
  children,
}: {
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("relative min-h-0 w-full flex-1 @container", className)}
      style={{ containerType: "size" }}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) scale(min(calc(100cqw / ${width}px), calc(100cqh / ${height}px)))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** How far back each card behind the front one sits, in the deck's own pixels. */
const DECK_STEP_Y = 18;
const DECK_SCALE_STEP = 0.05;

const DECK_WIDTH = CARD_WIDTH;
const DECK_HEIGHT = CARD_HEIGHT + DECK_STEP_Y * (ACTIONS.length - 1);

/**
 * The three actions as a deck: tapping the front card sends it to the back and
 * brings the next one up, so a phone can reach all three without scrolling.
 */
function Deck({ className }: { className?: string }) {
  const [order, setOrder] = useState(ACTIONS.map((_, i) => i));

  const cycle = () => setOrder(([first, ...rest]) => [...rest, first]);

  return (
    <FitStage width={DECK_WIDTH} height={DECK_HEIGHT} className={className}>
      <button
        type="button"
        onClick={cycle}
        aria-label="Show the next action"
        className="absolute inset-0 cursor-pointer text-left focus:outline-none"
      >
        {ACTIONS.map((action, index) => {
          const depth = order.indexOf(index);

          return (
            <span
              key={action.id}
              className="absolute inset-x-0 top-0 block rounded-lg shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] transition-transform duration-500 ease-out"
              style={{
                height: CARD_HEIGHT,
                zIndex: ACTIONS.length - depth,
                transform: `translateY(${depth * DECK_STEP_Y}px) scale(${1 - depth * DECK_SCALE_STEP})`,
              }}
            >
              <ActionExampleCard action={action} />
            </span>
          );
        })}
      </button>
    </FitStage>
  );
}

export function CommitmentMocks() {
  return (
    <div className="ob-mocks flex min-h-0 flex-1 flex-col justify-center lg:flex-none">
      <div className="hidden min-h-0 gap-6 lg:flex lg:h-[46vh]">
        {ROW_ORDER.map((index) => (
          <FitStage
            key={ACTIONS[index].id}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
          >
            <ActionExampleCard action={ACTIONS[index]} />
          </FitStage>
        ))}
      </div>

      <Deck className="lg:hidden" />
    </div>
  );
}
