import { cn } from "@alliance/shared/styles/util";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronRight } from "lucide-react";
import type React from "react";
import { zIndex } from "./zIndex";

function DropdownMenu({ ...props }: Menu.Root.Props) {
  return <Menu.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: Menu.Portal.Props) {
  return <Menu.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: Menu.Trigger.Props) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

type PositionerProps = React.ComponentProps<typeof Menu.Positioner>;
type Align = NonNullable<PositionerProps["align"]>;
type Side = NonNullable<PositionerProps["side"]>;

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: Menu.Popup.Props & {
  align?: Align;
  alignOffset?: number;
  side?: Side;
  sideOffset?: number;
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        className={cn(zIndex.popover, "isolate outline-none")}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
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

function DropdownMenuGroup({ ...props }: Menu.Group.Props) {
  return <Menu.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Menu.GroupLabel.Props & { inset?: boolean }) {
  return (
    <Menu.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-3 py-2 text-xs font-medium text-zinc-500 data-[inset]:pl-4",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: Menu.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default select-none items-center gap-1.5 rounded px-3 py-2 text-sm outline-none",
        "data-[highlighted]:bg-zinc-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[variant=destructive]:text-red-600 data-[variant=destructive]:data-[highlighted]:bg-red-50",
        "data-[inset]:pl-4",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: Menu.SubmenuRoot.Props) {
  return <Menu.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Menu.SubmenuTrigger.Props & { inset?: boolean }) {
  return (
    <Menu.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default select-none items-center gap-1.5 rounded px-3 py-2 text-sm outline-none",
        "data-[highlighted]:bg-zinc-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[inset]:pl-4",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4" />
    </Menu.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -4,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        className={cn(zIndex.popover, "isolate outline-none")}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <Menu.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(
            "min-w-[140px] rounded-md border border-zinc-200 bg-white p-1 shadow-lg text-zinc-900 outline-none overflow-x-hidden overflow-y-auto",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: Menu.CheckboxItem.Props & { inset?: boolean }) {
  return (
    <Menu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      checked={checked}
      className={cn(
        "relative flex cursor-default select-none items-center gap-1.5 rounded py-2 pl-3 pr-8 text-sm outline-none",
        "data-[highlighted]:bg-zinc-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[inset]:pl-4",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span
        className="absolute right-2 flex size-4 items-center justify-center pointer-events-none"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <Menu.CheckboxItemIndicator>
          <Check className="size-4" />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: Menu.RadioGroup.Props) {
  return <Menu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: Menu.RadioItem.Props & { inset?: boolean }) {
  return (
    <Menu.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default select-none items-center gap-1.5 rounded py-2 pl-3 pr-8 text-sm outline-none",
        "data-[highlighted]:bg-zinc-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[inset]:pl-4",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span
        className="absolute right-2 flex size-4 items-center justify-center pointer-events-none"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <Menu.RadioItemIndicator>
          <Check className="size-4" />
        </Menu.RadioItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

function DropdownMenuSeparator({ className, ...props }: Menu.Separator.Props) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-zinc-200 -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-zinc-500", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
