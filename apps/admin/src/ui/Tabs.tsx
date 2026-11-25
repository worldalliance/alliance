import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "./cn";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn("flex gap-0.5 border-b border-line", className)}
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "-mb-px inline-flex h-tab items-center gap-1.5 border-b-2 border-transparent px-2.5 font-medium whitespace-nowrap text-fg-muted transition-colors duration-fast focus-ring hover:text-fg data-active:border-accent data-active:text-fg data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel className={cn("focus-ring", className)} {...props} />
  );
}

export { Tabs, TabsList, TabsPanel, TabsTab };
