import type { ReactNode } from "react";
import Button, { ButtonVariant } from "../../../../ui/Button";

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant={ButtonVariant.Ghost} size="small" onClick={onClick}>
      Try again
    </Button>
  );
}

/** A part of a rule that didn't load: what failed, then "Try again". */
export function LoadFailure({
  onRetry,
  children,
}: {
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-caption text-danger">
      {children}
      <RetryButton onClick={onRetry} />
    </div>
  );
}
