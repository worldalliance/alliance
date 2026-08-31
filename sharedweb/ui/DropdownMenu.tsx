import { cn } from "@alliance/shared/styles/util";
import { Menu } from "@base-ui/react/menu";
import type React from "react";
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
            "min-w-32 rounded-md border border-zinc-200 bg-white p-1 shadow-lg text-zinc-900 outline-none overflow-x-hidden overflow-y-auto",
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
        "relative flex cursor-default select-none items-center gap-1.5 rounded px-3 py-2 text-sm outline-none",
        "data-[highlighted]:bg-zinc-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export { DropdownMenuContent, DropdownMenuItem };
