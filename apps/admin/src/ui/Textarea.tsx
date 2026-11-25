import type React from "react";
import { cn } from "./cn";
import { controlClass } from "./styles";

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlClass, "min-h-20 py-2", className)}
      {...props}
    />
  );
}
