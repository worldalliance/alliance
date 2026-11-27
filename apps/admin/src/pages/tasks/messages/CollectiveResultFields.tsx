import type { CollectiveResultTexts } from "../../../lib/updatePreview";
import { Input } from "../../../ui/Input";
import { Field } from "../../../ui/templates/Form";

const FIELDS = [
  {
    key: "shortNotifString",
    label: "Notification text for members who completed",
    help: null,
  },
  {
    key: "nonCompleterResult",
    label: "Notification text for members who didn't complete",
    help: "Includes members who were away or not involved, as well as those who didn't complete it.",
  },
] as const;

export function CollectiveResultFields({
  texts,
  onChange,
}: {
  texts: CollectiveResultTexts;
  onChange: (texts: CollectiveResultTexts) => void;
}) {
  return FIELDS.map(({ key, label, help }) => (
    <Field key={key} label={label} help={help}>
      {(control) => (
        <Input
          {...control}
          value={texts[key]}
          onChange={(event) =>
            onChange({ ...texts, [key]: event.target.value })
          }
        />
      )}
    </Field>
  ));
}
