import { cn } from "@alliance/shared/styles/util";
import { DocProse, DocProseSize } from "../../../site/DocProse";
import { BandHeading, BandHeadingSize } from "../../../site/PageShell";
import { ABOUT_SECTIONS } from "./copy";

export function AboutSections({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-4xl flex-col gap-12 md:gap-16",
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
            size={DocProseSize.Large}
            markdown={body}
            className="w-full text-left"
          />
        </section>
      ))}
    </div>
  );
}
