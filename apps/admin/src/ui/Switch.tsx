import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "./cn";

/** Name it with a wrapping `<label>` or `aria-label`. */
export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-line-control p-0.5 transition-colors duration-fast focus-ring data-checked:bg-accent data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-4 rounded-full bg-surface transition-transform duration-fast data-checked:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}
