import { LoaderCircle } from "lucide-react";
import React, { useId } from "react";
import { cn } from "./cn";

type SpinnerSize = "small" | "medium" | "large";

const SIZE: Record<SpinnerSize, string> = {
  small: "size-4",
  medium: "size-6",
  large: "size-9",
};

const Spinner: React.FC<{ size?: SpinnerSize }> = ({ size = "medium" }) => {
  const labelId = useId();
  return (
    <div role="status" aria-labelledby={labelId}>
      <LoaderCircle
        aria-hidden="true"
        className={cn("inline animate-spin text-accent", SIZE[size])}
      />
      <span id={labelId} className="sr-only">
        Loading...
      </span>
    </div>
  );
};

export default Spinner;
