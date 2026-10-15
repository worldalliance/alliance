import {
  PREVIEW_VARIATION_LABELS,
  PreviewVariation,
  type CollectiveResultTexts,
} from "../lib/updatePreview";

const GROUP_FIELDS = [
  {
    key: "nonCompleterResult",
    variation: PreviewVariation.DidNotComplete,
    hint: "Expected to act, but haven't completed it.",
  },
  {
    key: "uninvolvedResult",
    variation: PreviewVariation.Uninvolved,
    hint: "Not assigned, outside the action's cohort, away while it ran, or withdrew.",
  },
] as const;

export function CollectiveResultSplitFields({
  texts,
  onChange,
  inputClassName,
}: {
  texts: CollectiveResultTexts;
  onChange: (texts: CollectiveResultTexts) => void;
  inputClassName: string;
}) {
  return (
    <div className="mt-2 space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={texts.splitCollectiveResult}
          onChange={(e) =>
            onChange({ ...texts, splitCollectiveResult: e.target.checked })
          }
        />
        Split by who completed the action
      </label>
      {texts.splitCollectiveResult && (
        <>
          <p className="text-xs text-gray-500">
            The result above goes to members who completed the action. Leave a
            group empty to notify no one in it.
          </p>
          {GROUP_FIELDS.map(({ key, variation, hint }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">
                {PREVIEW_VARIATION_LABELS[variation]}
              </span>
              <span className="text-xs text-gray-500">{hint}</span>
              <input
                type="text"
                value={texts[key]}
                onChange={(e) => onChange({ ...texts, [key]: e.target.value })}
                className={inputClassName}
              />
            </label>
          ))}
        </>
      )}
    </div>
  );
}
