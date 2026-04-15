import { cn } from "@alliance/shared/styles/util";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ShareConfettiButtonProps {
  onClick: () => void | Promise<void>;
  label: string;
  copiedLabel: string;
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
}

const COPIED_LIFETIME_MS = 2000;

export default function ShareConfettiButton({
  onClick,
  label,
  copiedLabel,
  icon: Icon,
  className,
  iconClassName,
  labelClassName,
}: ShareConfettiButtonProps) {
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
    await onClick();
    setIsCopied(true);

    if (copiedResetTimeoutRef.current !== null) {
      window.clearTimeout(copiedResetTimeoutRef.current);
    }

    copiedResetTimeoutRef.current = window.setTimeout(() => {
      setIsCopied(false);
      copiedResetTimeoutRef.current = null;
    }, COPIED_LIFETIME_MS);
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={cn("flex items-center gap-x-1 transition-colors", className)}
    >
      <Icon className={iconClassName} />
      <span className={labelClassName}>{isCopied ? copiedLabel : label}</span>
    </button>
  );
}
