import type { FormSchema } from "@alliance/common/forms/form-schema";
import { sourceVariablesInSharedOutput } from "@alliance/common/forms/variable-interpolation";
import { useMemo } from "react";
import { Banner, BannerTone } from "../../../../ui/templates/Banner";

/** A save is refused while an output view reads another form through a formula. */
export function SharedOutputSourceWarning({ schema }: { schema: FormSchema }) {
  const references = useMemo(
    () => sourceVariablesInSharedOutput(schema),
    [schema],
  );
  if (references.length === 0) return null;
  return (
    <Banner tone={BannerTone.Danger} inline>
      <p className="font-medium">
        Output views can&apos;t show a formula that reads another form&apos;s
        answers or aggregate counts. Remove these references to save:
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {references.map(({ name, location, viewId }) => (
          <li key={`${viewId}:${location}:${name}`}>
            <span className="font-mono text-xs">
              #{"{"}
              {name}
              {"}"}
            </span>{" "}
            in {viewId} › {location}
          </li>
        ))}
      </ul>
    </Banner>
  );
}
