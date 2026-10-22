import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useState } from "react";

type InlineNameFormProps = {
  label: string;
  placeholder: string;
  submitLabel: string;
  maxLength: number;
  disabled: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

const InlineNameForm: React.FC<InlineNameFormProps> = ({
  label,
  placeholder,
  submitLabel,
  maxLength,
  disabled,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <input
        autoFocus
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <Button
        color={ButtonColor.White}
        size="small"
        type="submit"
        disabled={disabled || !name.trim()}
      >
        {submitLabel}
      </Button>
      <Button color={ButtonColor.Transparent} size="small" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
};

export default InlineNameForm;
