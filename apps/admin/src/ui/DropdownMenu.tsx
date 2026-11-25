import { Menu } from "@base-ui/react/menu";
import type React from "react";
import { cn } from "./cn";
import { popupClass } from "./styles";
import { zIndex } from "./zIndex";

type Align = NonNullable<React.ComponentProps<typeof Menu.Positioner>["align"]>;

function DropdownMenuContent({
  align = "start",
  sideOffset = 4,
  className,
  ...props
}: Menu.Popup.Props & {
  align?: Align;
  sideOffset?: number;
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        className={cn(zIndex.popover, "isolate outline-none")}
        align={align}
        sideOffset={sideOffset}
      >
        <Menu.Popup
          className={cn(
            popupClass,
            "min-w-32 overflow-x-hidden overflow-y-auto p-1",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({ className, ...props }: Menu.Item.Props) {
  return (
    <Menu.Item
      className={cn(
        "relative flex min-h-control-sm cursor-default items-center gap-2 rounded-sm px-2 py-1 outline-none select-none",
        "data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-surface-2",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: Menu.Separator.Props) {
  return (
    <Menu.Separator className={cn("my-1 h-px bg-line", className)} {...props} />
  );
}

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
