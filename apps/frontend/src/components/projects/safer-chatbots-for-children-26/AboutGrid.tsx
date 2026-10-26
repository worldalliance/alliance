import { cn } from "@alliance/shared/styles/util";
import { DocProse, DocProseSize } from "../../../site/DocProse";
import { BandHeading, BandHeadingSize } from "../../../site/PageShell";
import { ABOUT_SECTIONS } from "./copy";

export function AboutGrid({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-2 md:gap-y-16",
        className,
      )}
    >
      {ABOUT_SECTIONS.map(({ heading, body }) => (
        <section
          key={heading}
          className="flex flex-col items-start gap-5 text-left"
        >
          <BandHeading size={BandHeadingSize.Section} className="text-left">
            {heading}
          </BandHeading>
          <DocProse
            size={DocProseSize.Default}
            markdown={body}
            className="w-full text-left"
          />
        </section>
      ))}
    </div>
  );
}
