import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { cn } from "@alliance/shared/styles/util";
import { href, Link } from "react-router";
import {
  ACTION_PRIORITY_LABELS,
  type ActionPriorityTags,
  type FeaturedImpactAction,
} from "../content/featuredImpactActions";
import { useContract } from "../lib/useContract";
import { DocProse } from "./DocProse";
import { MEMBER_CONTRACT_TITLE } from "./docContent";

/**
 * One outcome from `content/featuredImpactActions`. The emphasis carries the
 * result; the rest says how members got there. The card links at the action it
 * came from, as the current progress cards do.
 */
export function ImpactCard({
  action,
  className,
}: {
  action: FeaturedImpactAction;
  className?: string;
}) {
  const external = Boolean(action.customLink?.startsWith("http"));
  const to =
    action.customLink ??
    href("/actions/:id", { id: action.actionId.toString() });

  const body = (
    <>
      {action.imageSrc && (
        <img
          src={action.imageSrc}
          alt={action.imageAlt ?? ""}
          aria-hidden={action.imageAlt ? undefined : true}
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-1.5 p-5">
        <PriorityTags tags={action.tags} />
        <p className="text-[1.05rem] leading-snug font-medium text-[var(--site-primary)]">
          {action.emphasis}
        </p>
        <p className="text-[0.98rem] leading-snug text-[var(--site-ink)]/65">
          {action.rest}
        </p>
      </div>
    </>
  );

  const classes = cn(
    "flex flex-col overflow-hidden bg-[var(--site-surface)]",
    "transition-transform duration-300 ease-out hover:-translate-y-0.5",
    className,
  );
  const style = { borderRadius: "var(--site-radius-card)" };

  return external ? (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className={classes}
      style={style}
    >
      {body}
    </a>
  ) : (
    <Link to={to} className={classes} style={style}>
      {body}
    </Link>
  );
}

function PriorityTags({ tags }: { tags: ActionPriorityTags }) {
  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-1">
      {tags.map((tag) => (
        <li
          key={tag}
          className="text-[0.75rem] tracking-wide text-[var(--site-ink)]/45 uppercase"
        >
          {ACTION_PRIORITY_LABELS[tag]}
        </li>
      ))}
    </ul>
  );
}

/** A written outcome with no action behind it, so it carries no link. */
export function ProgressLinkCard({
  title,
  description,
  tags,
  to,
  className,
}: {
  title: string;
  description: string;
  tags: ActionPriorityTags;
  to: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col gap-1.5 bg-[var(--site-surface)] p-5",
        "transition-transform duration-300 ease-out hover:-translate-y-0.5",
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <PriorityTags tags={tags} />
      <p className="text-[1.05rem] leading-snug font-medium text-[var(--site-primary)]">
        {title}
      </p>
      <p className="text-[0.98rem] leading-snug text-[var(--site-ink)]/65">
        {description}
      </p>
      <span className="mt-1 text-[0.85rem] text-[var(--site-link)]">
        Read the write-up
      </span>
    </Link>
  );
}

/** The live membership contract, quoted the way the current site quotes it. */
export function ContractCard({ caption }: { caption?: string }) {
  const { latestContract } = useContract();
  const markdown = latestContract?.markdown ?? PLACEHOLDER_CONTRACT_MARKDOWN;

  return (
    <figure className="flex flex-col gap-3">
      <div
        id="contract"
        className="border border-[var(--site-ink)]/12 bg-[var(--site-surface-alt)] p-6 sm:p-8"
        style={{ borderRadius: "var(--site-radius-card)" }}
      >
        <p className="text-sm tracking-wide text-[var(--site-ink)]/45 uppercase">
          {MEMBER_CONTRACT_TITLE}
        </p>
        <DocProse markdown={markdown} className="mt-4" />
      </div>
      {caption && (
        <figcaption className="text-sm text-[var(--site-ink)]/50">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
