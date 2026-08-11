import { VariableTextField } from "../VariableTextField";

type FieldLabelEditorProps = {
  value: string | null;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function FieldLabelEditor({
  value,
  onChange,
  label = "Field Label",
  placeholder = "Enter field label",
}: FieldLabelEditorProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      <VariableTextField
        multiline
        rows={1}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
      />
    </div>
  );
}
