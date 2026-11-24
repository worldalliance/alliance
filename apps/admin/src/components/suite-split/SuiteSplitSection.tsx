import React, { useRef } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useSuiteSplit } from "../../lib/useSuiteSplit";
import SuiteSplitConvert from "./SuiteSplitConvert";
import SuiteSplitEditor from "./SuiteSplitEditor";

/**
 * A suite's groups: the editor once it uses them, otherwise the way to start
 * using them while it isn't scheduled. The heading stays mounted, so focus
 * moves to it when the control holding focus goes away.
 */
const SuiteSplitSection: React.FC<{
  suiteId: number;
  usesGroups: boolean;
  scheduled: boolean;
}> = ({ suiteId, usesGroups, scheduled }) => {
  const { split, convert, save, preview } = useSuiteSplit(suiteId, usesGroups);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = () => heading.current?.focus();
  if (!usesGroups && scheduled) return null;
  const body = !usesGroups ? (
    <SuiteSplitConvert convert={convert} onConverted={focusHeading} />
  ) : split.data !== undefined ? (
    <SuiteSplitEditor
      split={split.data}
      onSave={save.mutateAsync}
      onPreview={(groups) => preview.mutateAsync(groups)}
      onLoadLatest={focusHeading}
    />
  ) : split.isError ? (
    <p role="alert" className="text-sm text-red-700">
      {adminRefusalMessage(split.error, "Couldn't load the groups.")}
    </p>
  ) : (
    <p className="text-sm text-zinc-600">Loading groups…</p>
  );
  return (
    <section aria-labelledby="split-heading" className="space-y-2">
      <h2
        id="split-heading"
        ref={heading}
        tabIndex={-1}
        className="font-semibold"
      >
        Groups
      </h2>
      {body}
    </section>
  );
};

export default SuiteSplitSection;
