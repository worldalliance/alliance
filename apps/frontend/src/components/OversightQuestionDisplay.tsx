import { cn } from "@alliance/shared/styles/util";
import React from "react";

export const ALLIANCE_OVERSIGHT_QUESTION = "Which do you prefer?";

export const ALLIANCE_OVERSIGHT_OPTIONS = [
  "I prefer the Alliance to continue to operate.",
  "I prefer the Alliance to stop planning and running all actions until it changes how it operates.",
] as const;

export type OversightQuestionDisplayProps = {
  question?: string;
  options?: readonly string[];
  className?: string;
};

const OversightQuestionDisplay: React.FC<OversightQuestionDisplayProps> = ({
  question = ALLIANCE_OVERSIGHT_QUESTION,
  options = ALLIANCE_OVERSIGHT_OPTIONS,
  className,
}) => {
  const name = React.useId();
  const questionId = React.useId();

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      className={cn(
        "flex flex-col gap-y-3 bg-zinc-50 p-6 rounded border border-zinc-200",
        className,
      )}
    >
      <p id={questionId} className="text-base text-zinc-900">
        {question}
      </p>
      {options.map((option, index) => (
        <label
          key={index}
          className="flex items-start gap-3 cursor-default text-zinc-900"
        >
          <input
            type="radio"
            name={name}
            disabled
            readOnly
            className="mt-1 h-4 w-4 shrink-0 border-zinc-300 text-zinc-900"
          />
          <span className="text-base leading-snug">{option}</span>
        </label>
      ))}
    </div>
  );
};

export default OversightQuestionDisplay;
