import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { cn } from "@alliance/shared/styles/util";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ContractDescriptionList } from "../components/ContractDescriptionList";
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
          className="text-xs font-medium bg-(--site-primary) px-2.5 py-1 rounded-md text-white tracking-wide"
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
  to?: string;
  className?: string;
  children: ReactNode;
}) {
  const classes = cn(
    "flex flex-col gap-1.5 bg-(--site-surface) p-5",
    to &&
      "inset-ring-1 inset-ring-transparent hover:inset-ring-(--site-primary)",
    className,
  );
  if (!to) {
    return (
      <div className={classes} style={progressCardStyle}>
        {children}
      </div>
    );
  }
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
  tags?: ActionPriorityTags;
}) {
  return (
    <>
      {tags && <PriorityTags tags={tags} />}
      <p
        className={cn(
          "text-base leading-snug font-medium text-black sm:text-lg",
          tags && "mt-2 sm:mt-4",
        )}
      >
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
  arrow = false,
  tagsAtBottom = false,
}: {
  title: string;
  description: string;
  tags: ActionPriorityTags;
  to?: string;
  className?: string;
  imageSrc?: string;
  imageAlt?: string;
  arrow?: boolean;
  tagsAtBottom?: boolean;
}) {
  return (
    <ProgressCardLink to={to} className={className}>
      <div
        className={cn(
          "flex items-center gap-4",
          tagsAtBottom && "flex-1 items-stretch",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <ProgressCardCopy
            title={title}
            description={description}
            tags={tagsAtBottom ? undefined : tags}
          />
          {imageSrc && (
            <img
              src={imageSrc}
              alt={imageAlt ?? ""}
              aria-hidden={imageAlt ? undefined : true}
              className="aspect-16/10 w-full object-cover mt-2 sm:mt-4"
            />
          )}
          {tagsAtBottom && (
            <div className="mt-auto pt-2 sm:pt-4">
              <PriorityTags tags={tags} />
            </div>
          )}
        </div>
        {to && arrow && (
          <ArrowRight
            className="size-5 shrink-0 text-(--site-primary)"
            aria-hidden
          />
        )}
      </div>
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
      imageSrc={action.imageSrc}
      imageAlt={action.imageAlt}
      className={className}
      tagsAtBottom
    />
  );
}

function ContractTerms() {
  const { latestContract } = useContract();
  return (
    <ContractDescriptionList
      items={latestContract?.description}
      markdown={latestContract?.markdown ?? PLACEHOLDER_CONTRACT_MARKDOWN}
    />
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
  [DocProseSize.Large]: "p-6 sm:p-8",
};

export function ContractCard({
  caption,
  terms = false,
  size = DocProseSize.Default,
}: {
  caption?: string;
  /** The live contract's numbered terms with its markdown folded away, as the membership page shows it. */
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
          terms && "pt-9 pl-8.5 text-xl sm:pt-12 sm:pl-11.5",
        )}
        style={{ borderRadius: "var(--site-radius-card)" }}
      >
        {terms ? (
          <div className="[zoom:0.926]">
            <ContractTerms />
          </div>
        ) : (
          <ContractMarkdown size={size} />
        )}
      </div>
      {caption && (
        <figcaption className="text-sm text-zinc-500">{caption}</figcaption>
      )}
    </figure>
  );
}
