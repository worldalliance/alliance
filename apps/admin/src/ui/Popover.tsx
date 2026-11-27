import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type React from "react";
import { cn } from "./cn";
import { popupClass } from "./styles";
import { zIndex } from "./zIndex";

type PositionerProps = React.ComponentProps<typeof PopoverPrimitive.Positioner>;

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverClose = PopoverPrimitive.Close;

function PopoverContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PositionerProps, "side" | "sideOffset" | "align">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className={cn(zIndex.popover, "isolate")}
      >
        <PopoverPrimitive.Popup
          className={cn(popupClass, "p-3", className)}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      className={cn("font-semibold", className)}
      {...props}
    />
  );
}

export { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger };
