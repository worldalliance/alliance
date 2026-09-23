import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React from "react";

const LoadFailed: React.FC<{
  message: string;
  onRetry: () => void;
  retrying: boolean;
}> = ({ message, onRetry, retrying }) => (
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
