import type React from "react";
import { cn } from "./cn";
import { controlClass } from "./styles";

/** A native select: the platform's own list, keyboard and screen-reader behaviour. */
export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select className={cn(controlClass, "h-control", className)} {...props} />
  );
}
