import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React from "react";

export type LoadFailure = { onRetry: () => void; retrying: boolean };

const LoadFailed: React.FC<LoadFailure & { message: string }> = ({
  message,
  onRetry,
  retrying,
}) => (
  <div className="flex flex-col items-center gap-y-2 py-4">
    <p className="text-center text-zinc-500 text-sm">{message}</p>
    <Button
      color={ButtonColor.BlueOutline}
      onClick={onRetry}
      disabled={retrying}
      size="small"
    >
      Try again
    </Button>
  </div>
);

export default LoadFailed;
