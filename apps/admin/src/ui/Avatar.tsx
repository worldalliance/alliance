import { thumbnailSrc } from "@alliance/common/image-src";
import { resolveImageSrc } from "@alliance/sharedweb/lib/imageSrc";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "./cn";

const DEFAULT_USER_ICON_SRC = "/noun-user-icon.svg";

const sizeClasses = {
  mini: "size-4",
  small: "size-6",
  medium: "size-8",
  large: "size-9",
  huge: "size-29",
  override: "",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

/**
 * The 128px thumbnail covers anything rendered up to ~42px on a 3x screen.
 * `huge` is 116px. `override` takes its size from a caller's class and so has
 * to be judged at the call site, with the `thumbnail` prop.
 */
const usesThumbnail: Record<AvatarSize, boolean> = {
  mini: true,
  small: true,
  medium: true,
  large: true,
  huge: false,
  override: false,
};

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
        "relative inline-flex shrink-0 overflow-hidden rounded-full align-middle select-none",
        sizeClasses[size],
        className,
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
        "aspect-square size-full max-h-full min-h-0 max-w-full min-w-0 rounded-full object-cover",
        className,
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
        "flex size-full max-h-full min-h-0 max-w-full min-w-0 items-center justify-center overflow-hidden rounded-full bg-surface text-fg-muted inset-ring inset-ring-line-strong",
        className,
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
  thumbnail = usesThumbnail[size],
}: {
  pfp: string | null;
  className?: string;
  size?: AvatarSize;
  alt?: string;
  /** Set alongside `size="override"` when the class renders under ~42px. */
  thumbnail?: boolean;
}) {
  const src = pfp ? resolveImageSrc(pfp) : null;
  return (
    <Avatar size={size} className={className} key={src ?? "default"}>
      {src ? (
        <>
          <AvatarImage src={thumbnail ? thumbnailSrc(src) : src} alt={alt} />
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

export { Avatar, AvatarFallback, AvatarImage, AvatarProfile };
