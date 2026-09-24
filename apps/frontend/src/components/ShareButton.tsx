import { cn } from "@alliance/shared/styles/util";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@alliance/sharedweb/ui/Tooltip";
import { milliseconds } from "date-fns";
import { CheckIcon, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ShareButtonProps {
  onClick: () => boolean | void | Promise<boolean | void>;
  label: string;
  copiedLabel: string;
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  iconOnly?: boolean;
}

const COPIED_LIFETIME_MS = milliseconds({ seconds: 2 });

export default function ShareButton({
  onClick,
  label,
  copiedLabel,
  icon: Icon,
  className,
  iconClassName,
  labelClassName,
  iconOnly = false,
}: ShareButtonProps) {
  const copiedResetTimeoutRef = useRef<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = async () => {
    const didSucceed = await onClick();
    if (didSucceed === false) {
      return false;
    }
    setIsCopied(true);

    if (copiedResetTimeoutRef.current !== null) {
      window.clearTimeout(copiedResetTimeoutRef.current);
    }

    copiedResetTimeoutRef.current = window.setTimeout(() => {
      setIsCopied(false);
      copiedResetTimeoutRef.current = null;
    }, COPIED_LIFETIME_MS);

    return true;
  };

  const currentLabel = isCopied ? copiedLabel : label;
  const buttonClassName = cn(
    "flex items-center gap-x-1 transition-colors disabled:cursor-default",
    className,
  );

  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={handleClick}
              aria-label={currentLabel}
              className={buttonClassName}
            />
          }
        >
          {isCopied ? (
            <CheckIcon className={iconClassName} />
          ) : (
            <Icon className={iconClassName} />
          )}
        </TooltipTrigger>
        <TooltipContent>{currentLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={buttonClassName}>
      <Icon className={iconClassName} />
      <span className={labelClassName}>{currentLabel}</span>
    </button>
  );
}
