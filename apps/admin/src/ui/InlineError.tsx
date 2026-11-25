import { type ReactNode } from "react";
import { cn } from "./cn";

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
      className={cn("flex items-center gap-2 text-body text-danger", className)}
    >
      <span>{message}</span>
      {children}
    </div>
  );
}
