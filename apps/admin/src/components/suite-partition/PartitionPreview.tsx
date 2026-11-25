import type {
  PartitionPartDraftDto,
  PartitionPreviewDto,
} from "@alliance/shared/client";
import React from "react";

const PartitionPreview: React.FC<{
  preview: PartitionPreviewDto;
  parts: PartitionPartDraftDto[];
  outOfDate: boolean;
}> = ({ preview, parts, outOfDate }) => {
  const name = (partId: string) =>
    parts.find((part) => part.id === partId)?.name || "Unnamed part";
  return (
    <section aria-labelledby="partition-preview-heading" className="space-y-3">
      <h3 id="partition-preview-heading" className="font-semibold text-sm">
        Preview of {preview.population}{" "}
        {preview.population === 1 ? "member" : "members"} with an agreement
      </h3>
      {outOfDate && (
        <p className="text-sm text-amber-800">
          The parts changed since this preview. Run it again to update it.
        </p>
      )}
      <table className="text-sm">
        <tbody>
          {preview.parts.map(({ partId, count }) => (
            <tr key={partId}>
              <th scope="row" className="text-left pr-4 font-normal">
                {name(partId)}
              </th>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="text-sm space-y-1">
        <li>Required work: {preview.byWork.required}</li>
        <li>Optional work only: {preview.byWork.optionalOnly}</li>
        <li>Nothing assigned: {preview.byWork.nothing}</li>
        <li>Couldn&apos;t decide: {preview.couldNotDecide}</li>
      </ul>
      <p className="text-sm text-zinc-600">
        Members with only optional work neither miss the suite nor reset their
        streak.
      </p>
      {preview.errors.length > 0 && (
        <div className="space-y-1">
          <h4 className="font-semibold text-sm text-red-800">
            Errors members hit
          </h4>
          <ul className="text-sm text-red-700 list-disc pl-5">
            {preview.errors.map(({ message, count }) => (
              <li key={message}>
                {message} ({count} {count === 1 ? "member" : "members"})
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview.untakenBranches.length > 0 && (
        <div className="space-y-1">
          <h4 className="font-semibold text-sm">Parts no member reached</h4>
          <ul className="text-sm list-disc pl-5">
            {preview.untakenBranches.map(({ where, text }, index) => (
              <li key={`${where}:${index}`}>
                In {where}: <code className="font-mono">{text}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default PartitionPreview;
