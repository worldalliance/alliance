import type { CollectiveResultTexts } from "../lib/updatePreview";

const FIELDS = [
  {
    key: "shortNotifString",
    label: "Notif text for people who completed",
    hint: null,
  },
  {
    key: "nonCompleterResult",
    label: "Notif text for people who didn't complete",
    hint: "Includes people away or uninvolved, as well as people who failed to complete.",
  },
] as const;

export function CollectiveResultFields({
  texts,
  onChange,
  inputClassName,
}: {
  texts: CollectiveResultTexts;
  onChange: (texts: CollectiveResultTexts) => void;
  inputClassName: string;
}) {
  return (
    <div className="space-y-3">
      {FIELDS.map(({ key, label, hint }) => (
        <label key={key} className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          {hint && <span className="text-xs text-gray-500">{hint}</span>}
          <input
            type="text"
            value={texts[key]}
            onChange={(e) => onChange({ ...texts, [key]: e.target.value })}
            className={inputClassName}
          />
        </label>
      ))}
    </div>
  );
}
