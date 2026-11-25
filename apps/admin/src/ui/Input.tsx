import type React from "react";
import { cn } from "./cn";
import { controlClass } from "./styles";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input className={cn(controlClass, "h-control", className)} {...props} />
  );
}
