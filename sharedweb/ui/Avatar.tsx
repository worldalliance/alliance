import * as React from "react";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "@alliance/shared/styles/util";

const DEFAULT_USER_ICON_SRC = "/noun-user-icon.svg";

const sizeClasses = {
  mini: "w-4 h-4 rounded-xs",
  small: "w-6 h-6 rounded",
  medium: "w-8 h-8 rounded",
  large: "w-9 h-9 rounded",
  huge: "w-29 h-29 rounded",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

function Avatar({
  className,
  size = "large",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: AvatarSize;
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative shrink-0 select-none inline-flex align-middle overflow-hidden",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      loading="lazy"
      className={cn(
        "aspect-square size-full min-w-0 min-h-0 max-w-full max-h-full object-cover rounded-[inherit]",
        className
      )}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-white text-zinc-500 flex size-full min-w-0 min-h-0 max-w-full max-h-full items-center justify-center rounded-[inherit] ring-1 ring-zinc-300 ring-inset overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

function AvatarProfile({
  pfp,
  className,
  size = "large",
  alt = "Profile",
}: {
  pfp: string | null;
  className?: string;
  size?: AvatarSize;
  alt?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {pfp ? (
        <>
          <AvatarImage src={pfp} alt={alt} />
          <AvatarFallback>
            <img
              src={DEFAULT_USER_ICON_SRC}
              alt=""
              className="size-full object-cover"
              aria-hidden
            />
          </AvatarFallback>
        </>
      ) : (
        <AvatarFallback>
          <img
            src={DEFAULT_USER_ICON_SRC}
            alt=""
            className="size-full object-cover"
            aria-hidden
          />
        </AvatarFallback>
      )}
    </Avatar>
  );
}

// unused, default shadcn-like implementation
function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 select-none",
        "group-data-[size=mini]/avatar:size-2 group-data-[size=mini]/avatar:[&>svg]:hidden",
        "group-data-[size=small]/avatar:size-2 group-data-[size=small]/avatar:[&>svg]:hidden",
        "group-data-[size=medium]/avatar:size-2.5 group-data-[size=medium]/avatar:[&>svg]:size-2",
        "group-data-[size=large]/avatar:size-2.5 group-data-[size=large]/avatar:[&>svg]:size-2",
        "group-data-[size=huge]/avatar:size-3 group-data-[size=huge]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn("group/avatar-group flex items-center gap-1", className)}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  size = "small",
  ...props
}: React.ComponentProps<"div"> & { size?: AvatarSize }) {
  const textSizeClass = {
    mini: "text-[10px]",
    small: "text-xs",
    medium: "text-sm",
    large: "text-sm",
    huge: "text-base",
  } as const;
  return (
    <div
      data-slot="avatar-group-count"
      data-size={size}
      className={cn(
        "bg-zinc-200 text-zinc-600 flex items-center justify-center ring-2 ring-white shrink-0",
        sizeClasses[size],
        textSizeClass[size],
        "[&>svg]:size-3 [&>svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  AvatarProfile,
};

export { DEFAULT_USER_ICON_SRC };
