import {
  CONTRACT_TERMS,
  PLACEHOLDER_CONTRACT_MARKDOWN,
} from "@alliance/shared/lib/contract";
import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { href, Link } from "react-router";
import {
  ACTION_PRIORITY_LABELS,
  type ActionPriorityTags,
  type FeaturedImpactAction,
} from "../content/featuredImpactActions";
import { useContract } from "../lib/useContract";
import { DocProse } from "./DocProse";
import { MEMBER_CONTRACT_TITLE } from "./docContent";

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
    "transition-transform duration-300 ease-out hover:-translate-y-0.5",
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

function ContractTermList() {
  return (
    <ol className="mt-4 flex list-outside list-decimal flex-col gap-3 pl-6 text-[1.05rem] leading-[1.65] text-[var(--site-ink)]/85 sm:text-[1.12rem]">
      {CONTRACT_TERMS.map((term) => (
        <li key={term.text}>
          {term.text}
          {term.subItems && (
            <ol className="mt-2 flex list-outside list-[lower-alpha] flex-col gap-2 pl-6">
              {term.subItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  );
}

function ContractMarkdown() {
  const { latestContract } = useContract();
  const markdown = latestContract?.markdown ?? PLACEHOLDER_CONTRACT_MARKDOWN;
  return <DocProse markdown={markdown} className="mt-4" />;
}

/** The membership contract, quoted the way the current site quotes it. */
export function ContractCard({
  caption,
  terms = false,
}: {
  caption?: string;
  /** Numbered terms instead of the live markdown. */
  terms?: boolean;
}) {
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
        {terms ? <ContractTermList /> : <ContractMarkdown />}
      </div>
      {caption && (
        <figcaption className="text-sm text-[var(--site-ink)]/50">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
