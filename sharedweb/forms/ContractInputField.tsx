import type { ContractField } from "@alliance/common/forms/form-schema";
import { CardStyle } from "@alliance/shared/styles/card";
import AppMarkdownWrapper from "../ui/AppMarkdownWrapper";
import Card from "../ui/Card";
import YesNoToggle from "../ui/YesNoToggle";
import { type FieldInputProps, ValidationMessage } from "./fieldParts";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

export function ContractInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  required,
}: FieldInputProps<ContractField>) {
  const contract = field.contract;
  const signedValue = typeof value === "boolean" ? value : undefined;
  return (
    <div className="space-y-3">
      {contract?.markdown ? (
        <>
          <div className="prose prose-sm max-w-none text-zinc-800 rounded border border-zinc-200 p-4 bg-white">
            <AppMarkdownWrapper markdownContent={contract.markdown} />
          </div>
          <Card
            style={CardStyle.White}
            className="flex flex-row gap-x-4 items-center justify-between"
          >
            <div>
              {!required && !isOutputView && <OptionalLabelPrefix />}
              <p className="font-medium">{field.signQuestion.trim()}</p>
            </div>
            <YesNoToggle
              value={signedValue}
              onChange={(next) => onChange?.(next)}
              disabled={disabled}
              yesLabel={field.yesLabel.trim()}
              noLabel={field.noLabel.trim()}
              ariaLabel={field.signQuestion.trim()}
            />
          </Card>
        </>
      ) : (
        <p className="text-sm text-zinc-500 italic">
          Select a contract in the form builder to preview.
        </p>
      )}
      <ValidationMessage message={errorMessage} />
    </div>
  );
}
