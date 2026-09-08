import { cn } from "@alliance/shared/styles/util";
import { type ReactNode } from "react";

interface InlineErrorProps {
  message?: string | null;
  className?: string;
  children?: ReactNode;
}

export default function InlineError({
  message,
  className,
  children,
}: InlineErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn("flex items-center gap-2 text-sm text-red-500", className)}
    >
      <span>{message}</span>
      {children}
    </div>
  );
}
