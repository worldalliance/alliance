import { cn } from "@alliance/shared/styles/util";
import { Button as BaseUIButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { LucideIcon } from "lucide-react";

export enum BaseButtonVariant {
  Stone = "stone",
  Green = "green",
  GreenOutline = "greenOutline",
  Red = "red",
  RedOutline = "redOutline",
  Light = "light",
  LightHover = "lightHover",
  Blue = "blue",
  BlueOutline = "blueOutline",
  Yellow = "yellow",
  Transparent = "transparent",
  TransparentMuted = "transparentMuted",
  Grey = "grey",
  Outline = "outline",
  White = "white",
  Black = "black",
}

export enum BaseButtonSize {
  Small = "small",
  Medium = "medium",
  MediumDynamic = "mediumDynamic",
  Large = "large",
}

const baseButtonVariants = cva(
  "inline-flex items-center justify-center rounded font-medium cursor-pointer box-border relative group disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
  {
    variants: {
      variant: {
        [BaseButtonVariant.Stone]:
          "bg-gray-4 text-white hover:bg-[#444] border border-[#444]",
        [BaseButtonVariant.Green]:
          "bg-green text-white hover:bg-[#4d8c1d] border border-green",
        [BaseButtonVariant.GreenOutline]:
          "border border-green text-green hover:bg-green/10",
        [BaseButtonVariant.Red]: "bg-red-100 !text-red-500 hover:bg-red-200",
        [BaseButtonVariant.RedOutline]: "border border-red-500 text-red-500",
        [BaseButtonVariant.Light]:
          "bg-zinc-200/60 border border-[#efeff1] !text-zinc-800",
        [BaseButtonVariant.LightHover]:
          "bg-zinc-200/60 hover:bg-zinc-200/80 !text-zinc-500",
        [BaseButtonVariant.Blue]:
          "bg-[#318dde] text-white border border-[#318dde]",
        [BaseButtonVariant.BlueOutline]:
          "border border-[#318dde] text-[#318dde] hover:bg-[#318dde]/10",
        [BaseButtonVariant.Yellow]: "bg-yellow-600",
        [BaseButtonVariant.Transparent]:
          "bg-transparent hover:bg-black/5 text-black !px-2 border border-transparent",
        [BaseButtonVariant.TransparentMuted]:
          "bg-transparent hover:bg-black/5 text-zinc-600 hover:text-zinc-900 !px-2 border border-transparent",
        [BaseButtonVariant.Grey]:
          "bg-zinc-200 !text-black hover:bg-zinc-300 border border-transparent",
        [BaseButtonVariant.Outline]:
          "border border-gray-2 text-black bg-transparent",
        [BaseButtonVariant.White]:
          "border border-gray-2 text-black bg-white hover:bg-zinc-50",
        [BaseButtonVariant.Black]:
          "bg-zinc-800 hover:bg-zinc-900 text-white border border-zinc-800 active:bg-zinc-700",
      },
      size: {
        [BaseButtonSize.Small]: "px-3 py-1.5 text-sm h-9 gap-x-1",
        [BaseButtonSize.Medium]: "px-4 py-2 text-base h-10 gap-x-2",
        [BaseButtonSize.MediumDynamic]:
          "px-2 md:px-4 py-1 md:py-1.5 text-base h-10 gap-x-2",
        [BaseButtonSize.Large]: "px-6 py-3 text-lg h-12 gap-x-3",
      },
    },
    defaultVariants: {
      variant: BaseButtonVariant.White,
      size: BaseButtonSize.Medium,
    },
  },
);

export type BaseButtonVariants = VariantProps<typeof baseButtonVariants>;

const ICON_SIZE: Record<BaseButtonSize, number> = {
  [BaseButtonSize.Small]: 12,
  [BaseButtonSize.Medium]: 18,
  [BaseButtonSize.MediumDynamic]: 18,
  [BaseButtonSize.Large]: 24,
};

export type BaseButtonProps = BaseUIButton.Props &
  BaseButtonVariants & {
    iconLeft?: LucideIcon;
    iconRight?: LucideIcon;
  };

function BaseButton({
  className,
  variant,
  size = BaseButtonSize.Medium,
  iconLeft: IconLeft,
  iconRight: IconRight,
  children,
  ...props
}: BaseButtonProps) {
  size ??= BaseButtonSize.Medium;
  const iconSize = ICON_SIZE[size];

  return (
    <BaseUIButton
      className={cn(baseButtonVariants({ variant, size }), className)}
      {...props}
    >
      {IconLeft ? (
        <span className="shrink-0">
          <IconLeft size={iconSize} />
        </span>
      ) : null}

      {children ? <span>{children}</span> : null}

      {IconRight ? (
        <span className="shrink-0">
          <IconRight size={iconSize} />
        </span>
      ) : null}
    </BaseUIButton>
  );
}

export { baseButtonVariants, BaseButton as default };
