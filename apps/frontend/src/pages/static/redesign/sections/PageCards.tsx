import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { cn } from "@alliance/shared/styles/util";
import type { FeaturedImpactAction } from "../../../../content/featuredImpactActions";
import { MEMBER_CONTRACT_TITLE } from "../docContent";
import type { RedesignVersion } from "../theme";
import { DocProse } from "./DocProse";

/**
 * One outcome from `content/featuredImpactActions`. The emphasis carries the
 * result; the rest says how members got there.
 */
export function ImpactCard({
  action,
  members,
  className,
}: {
  action: FeaturedImpactAction;
  /** Members on the roll when the action ran. */
  members?: number;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden bg-[var(--rd-surface)]",
        "transition-transform duration-300 ease-out hover:-translate-y-0.5",
        className,
      )}
      style={{ borderRadius: "var(--rd-radius-card)" }}
    >
      {action.imageSrc && (
        <img
          src={action.imageSrc}
          alt={action.imageAlt ?? ""}
          aria-hidden={action.imageAlt ? undefined : true}
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-1.5 p-5">
        <p className="text-[1.05rem] leading-snug font-medium text-[var(--rd-primary)]">
          {action.emphasis}
        </p>
        <p className="text-[0.98rem] leading-snug text-[var(--rd-ink)]/65">
          {action.rest}
        </p>
        {members !== undefined && (
          <p className="mt-1 text-[0.85rem] text-[#1E68D9]">
            {`${members} members at the time`}
          </p>
        )}
      </div>
    </article>
  );
}

/** The real membership contract, quoted the way the current site quotes it. */
export function ContractCard({
  version,
  caption,
}: {
  version: RedesignVersion;
  caption?: string;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div
        className="border border-[var(--rd-ink)]/12 bg-[var(--rd-surface-alt)] p-6 sm:p-8"
        style={{ borderRadius: "var(--rd-radius-card)" }}
      >
        <p className="text-sm tracking-wide text-[var(--rd-ink)]/45 uppercase">
          {MEMBER_CONTRACT_TITLE}
        </p>
        <DocProse
          version={version}
          markdown={PLACEHOLDER_CONTRACT_MARKDOWN}
          className="mt-4"
        />
      </div>
      {caption && (
        <figcaption className="text-sm text-[var(--rd-ink)]/50">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
