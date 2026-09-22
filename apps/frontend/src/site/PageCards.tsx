import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { href, Link } from "react-router";
import {
  ACTION_PRIORITY_LABELS,
  type ActionPriorityTags,
  type FeaturedImpactAction,
} from "../content/featuredImpactActions";
import { useContract } from "../lib/useContract";
import { DocProse, DocProseSize } from "./DocProse";

const progressCardStyle = { borderRadius: "var(--site-radius-card)" };

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

function ProgressCardLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const classes = cn(
    "flex flex-col gap-1.5 bg-[var(--site-surface)] p-5",
    "inset-ring-1 inset-ring-transparent hover:inset-ring-[var(--color-green)]",
    "transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5",
    className,
  );
  const external = to.startsWith("http");
  return external ? (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className={classes}
      style={progressCardStyle}
    >
      {children}
    </a>
  ) : (
    <Link to={to} className={classes} style={progressCardStyle}>
      {children}
    </Link>
  );
}

function ProgressCardCopy({
  title,
  description,
  tags,
}: {
  title: string;
  description: string;
  tags: ActionPriorityTags;
}) {
  return (
    <>
      <PriorityTags tags={tags} />
      <p className="mt-2 sm:mt-4 text-base leading-snug font-medium text-black sm:text-lg">
        {title}
      </p>
      <p className="text-base sm:text-lg leading-snug text-(--site-ink)/80 ">
        {description}
      </p>
    </>
  );
}

export function ProgressLinkCard({
  title,
  description,
  tags,
  to,
  className,
  imageSrc,
  imageAlt,
}: {
  title: string;
  description: string;
  tags: ActionPriorityTags;
  to: string;
  className?: string;
  imageSrc?: string;
  imageAlt?: string;
}) {
  return (
    <ProgressCardLink to={to} className={className}>
      {imageSrc && (
        <img
          src={imageSrc}
          alt={imageAlt ?? ""}
          aria-hidden={imageAlt ? undefined : true}
          className="aspect-16/10 w-full object-cover"
        />
      )}
      <ProgressCardCopy title={title} description={description} tags={tags} />
    </ProgressCardLink>
  );
}

/** Maps a featured action onto the same card as a written project. */
export function ImpactCard({
  action,
  className,
}: {
  action: FeaturedImpactAction;
  className?: string;
}) {
  return (
    <ProgressLinkCard
      title={action.emphasis}
      description={action.rest}
      tags={action.tags}
      to={
        action.customLink ??
        href("/actions/:id", { id: action.actionId.toString() })
      }
      imageSrc={action.imageSrc}
      imageAlt={action.imageAlt}
      className={className}
    />
  );
}

function ContractDescriptionList() {
  const { latestContract } = useContract();
  const items = latestContract?.description ?? [];
  if (items.length === 0) return null;
  return (
    <ol className="flex list-none flex-col gap-4 pl-0">
      {items.map((item, index) => (
        <li key={index} className="flex min-w-0 flex-col">
          <DocProse
            markdown={item.point}
            className="[&_p]:mt-0 [&_p]:leading-snug [&_p]:font-semibold [&_p]:text-black"
          />
          {item.subtext.trim() !== "" && (
            <DocProse
              markdown={item.subtext}
              className="[&_p]:mt-0 [&_p]:text-[0.9em] [&_p]:leading-snug [&_p]:text-zinc-700"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function ContractMarkdown({ size }: { size: DocProseSize }) {
  const { latestContract } = useContract();
  const markdown = latestContract?.markdown ?? PLACEHOLDER_CONTRACT_MARKDOWN;
  return <DocProse markdown={markdown} size={size} />;
}

/** The membership contract, quoted the way the current site quotes it. */
const CONTRACT_PAD: Record<DocProseSize, string> = {
  [DocProseSize.Default]: "p-6 sm:p-8",
  [DocProseSize.Compact]: "p-4",
};

export function ContractCard({
  caption,
  terms = false,
  size = DocProseSize.Default,
}: {
  caption?: string;
  /** Numbered description bullets from the live contract, instead of its markdown. */
  terms?: boolean;
  size?: DocProseSize;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div
        id="contract"
        className={cn(
          "scroll-mt-32 bg-zinc-100",
          CONTRACT_PAD[size],
          terms && "ring-2 ring-[var(--color-green)]",
        )}
        style={{ borderRadius: "var(--site-radius-card)" }}
      >
        {terms ? <ContractDescriptionList /> : <ContractMarkdown size={size} />}
      </div>
      {caption && (
        <figcaption className="text-sm text-zinc-500">{caption}</figcaption>
      )}
    </figure>
  );
}
