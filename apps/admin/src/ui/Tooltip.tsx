import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type React from "react";
import { cn } from "./cn";
import { popupClass } from "./styles";
import { zIndex } from "./zIndex";

type PositionerProps = React.ComponentProps<typeof TooltipPrimitive.Positioner>;
type Side = NonNullable<PositionerProps["side"]>;
type Align = NonNullable<PositionerProps["align"]>;

function Tooltip({
  disableHoverablePopup = true,
  ...props
}: TooltipPrimitive.Root.Props) {
  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      disableHoverablePopup={disableHoverablePopup}
      {...props}
    />
  );
}

function TooltipTrigger({
  delay = 0,
  closeDelay = 0,
  ...props
}: TooltipPrimitive.Trigger.Props) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      delay={delay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  ...props
}: TooltipPrimitive.Popup.Props & {
  align?: Align;
  alignOffset?: number;
  side?: Side;
  sideOffset?: number;
}) {
  return (
    <TooltipPrimitive.Portal data-slot="tooltip-portal">
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={cn(zIndex.popover, "isolate")}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(popupClass, "px-2 py-1 text-caption", className)}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
