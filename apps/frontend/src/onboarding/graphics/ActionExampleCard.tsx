import { cn } from "@alliance/shared/styles/util";
import CompletedBar from "@alliance/sharedweb/ui/CompletedBar";
import { ChevronRight, Clock } from "lucide-react";
import Timeline from "../../components/system/Timeline";

export enum TimelineEntryKind {
  Event = "event",
  Update = "update",
}

export type TimelineEntry =
  | { kind: TimelineEntryKind.Event; title: string; time: string }
  | {
      kind: TimelineEntryKind.Update;
      title: string;
      time: string;
      body: string;
    };

export type ActionExample = {
  id: string;
  title: string;
  description: string;
  timeline: TimelineEntry[];
  /** Sits under whichever timeline entry is at this index, as on the real page. */
  barAtIndex: number;
  completed: number;
  expected: number;
  minutes: number;
  faces: string[];
  /** The task write-up, which runs past the card and feathers out at its foot. */
  body: { heading?: string; text: string }[];
};

/** `AvatarProfile`'s `small` size, which is square with a small radius. */
function FaceRow({ faces }: { faces: string[] }) {
  return (
    <span className="flex shrink-0 gap-0.5" aria-hidden>
      {faces.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className="size-6 rounded object-cover"
        />
      ))}
    </span>
  );
}

function CompletedBlock({ action }: { action: ActionExample }) {
  return (
    <div className="mt-2 rounded-md border border-zinc-200 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[12.5px] text-zinc-600">
          {action.completed} / {action.expected} members completed
        </p>
        <FaceRow faces={action.faces} />
      </div>
      <CompletedBar
        percentage={Math.round((action.completed / action.expected) * 100)}
        height="h-2"
        dark
      />
    </div>
  );
}

function Entry({
  entry,
  highlighted,
}: {
  entry: TimelineEntry;
  highlighted: boolean;
}) {
  if (entry.kind === TimelineEntryKind.Update) {
    return (
      <div className="overflow-hidden rounded border border-zinc-200 bg-gray-1">
        <p className="border-b border-zinc-200 px-3 py-2 text-[12.5px] font-semibold">
          <span className="text-green">Update: </span>
          {entry.title}
          <span className="ml-1.5 font-normal text-zinc-500">{entry.time}</span>
        </p>
        <p className="bg-white px-3 py-2 text-[12.5px] leading-[1.45] text-zinc-700">
          {entry.body}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2">
      <p
        className={cn(
          "text-[12.5px] font-medium",
          highlighted ? "text-green" : "text-[var(--site-ink)]",
        )}
      >
        {entry.title}
      </p>
      <p className="text-[11.5px] text-zinc-500">{entry.time}</p>
    </div>
  );
}

/**
 * An action laid out the way `LargeActionCard` lays one out — title, then the
 * time estimate, then the description and timeline — from authored content
 * rather than the API, at a fixed pixel size for a caller that scales it.
 */
export function ActionExampleCard({ action }: { action: ActionExample }) {
  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-white p-4 pb-0"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-serif text-[17px] leading-tight font-medium text-[var(--site-ink)]">
            {action.title}
          </p>
          <p className="flex items-center gap-1.5 text-[12.5px] text-green">
            <Clock className="size-3.5" aria-label="Clock" />
            {action.minutes} minutes
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 rounded bg-zinc-100 px-2 py-1 text-[11.5px] text-black">
          Details
          <ChevronRight className="size-3" aria-hidden />
        </span>
      </div>

      <p className="mt-2.5 text-[12.5px] leading-[1.45] text-[var(--site-ink)]/75">
        {action.description}
      </p>

      <p className="mt-3.5 mb-2 text-[12.5px] font-semibold text-[var(--site-ink)]">
        Timeline
      </p>
      <Timeline currentIdx={0} dotSize={9}>
        {action.timeline.map((entry, i) => (
          <div key={entry.title}>
            <Entry entry={entry} highlighted={i === 0} />
            {i === action.barAtIndex && <CompletedBlock action={action} />}
          </div>
        ))}
      </Timeline>

      <div
        className="mt-4 flex min-h-0 flex-1 flex-col gap-2"
        style={{
          maskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)",
        }}
      >
        {action.body.map((block) => (
          <div key={block.text} className="flex flex-col gap-1">
            {block.heading && (
              <p className="text-[12.5px] font-semibold text-[var(--site-ink)]">
                {block.heading}
              </p>
            )}
            <p className="text-[12.5px] leading-[1.45] text-[var(--site-ink)]/75">
              {block.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
