import { cn } from "@alliance/shared/styles/util";
import React from "react";
import Button, { ButtonColor } from "./Button";

type YesNoToggleProps = {
  value?: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
  yesColor?: ButtonColor;
  noColor?: ButtonColor;
  className?: string;
  ariaLabel?: string;
  size?: "small" | "medium" | "large" | "mediumDynamic";
};

const YesNoToggle: React.FC<YesNoToggleProps> = ({
  value,
  onChange,
  disabled = false,
  yesLabel = "Yes",
  noLabel = "No",
  yesColor = ButtonColor.Black,
  noColor = ButtonColor.Black,
  className,
  ariaLabel,
  size = "medium",
}) => {
  const isYes = value === true;
  const isNo = value === false;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-row", className)}
    >
      <Button
        type="button"
        size={size}
        color={isYes ? yesColor : ButtonColor.White}
        onClick={() => onChange(true)}
        disabled={disabled}
        aria-pressed={isYes}
        className="rounded-r-none border-r-0"
      >
        {yesLabel}
      </Button>
      <Button
        type="button"
        size={size}
        color={isNo ? noColor : ButtonColor.White}
        onClick={() => onChange(false)}
        disabled={disabled}
        aria-pressed={isNo}
        className="rounded-l-none border-l-0"
      >
        {noLabel}
      </Button>
    </div>
  );
};

export default YesNoToggle;
