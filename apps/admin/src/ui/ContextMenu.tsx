import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import type { ReactNode } from "react";
import { DropdownMenuContent } from "./DropdownMenu";
import { MoreMenuItems, type MoreMenuItem } from "./MoreMenu";

/**
 * The same actions as a `MoreMenu`, opened by right-click, Shift+F10 or the
 * Menu key on `children`, such as an outline row. It is a second way in:
 * keep the actions reachable from a visible control too.
 */
export function ContextMenu({
  items,
  label,
  children,
}: {
  items: readonly MoreMenuItem[];
  /** What the menu acts on, as `MoreMenu`'s `subject`: "Text field: Town". */
  label: string;
  children: ReactNode;
}) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <DropdownMenuContent aria-label={`More: ${label}`} className="min-w-48">
        <MoreMenuItems items={items} />
      </DropdownMenuContent>
    </ContextMenuPrimitive.Root>
  );
}

export function ContextMenuTrigger({ children }: { children: ReactNode }) {
  return (
    <ContextMenuPrimitive.Trigger className="contents">
      {children}
    </ContextMenuPrimitive.Trigger>
  );
}
