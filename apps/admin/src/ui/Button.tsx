import { cva } from "class-variance-authority";
import React from "react";
import { Link } from "react-router";
import { cn } from "./cn";

export enum ButtonVariant {
  Primary = "primary",
  Default = "default",
  Soft = "soft",
  Ghost = "ghost",
  Danger = "danger",
  DangerOutline = "dangerOutline",
  AccentOutline = "accentOutline",
}

/**
 * The colours of the shared button this one replaced. A page moving to the new
 * design passes `variant` instead.
 */
export enum ButtonColor {
  Stone = "stone",
  Green = "green",
  Red = "red",
  RedOutline = "redOutline",
  Light = "light",
  Blue = "blue",
  BlueOutline = "blueOutline",
  Transparent = "transparent",
  White = "white",
  Black = "black",
}

const VARIANT_OF_COLOR: Record<ButtonColor, ButtonVariant> = {
  [ButtonColor.Stone]: ButtonVariant.Primary,
  [ButtonColor.Green]: ButtonVariant.Primary,
  [ButtonColor.Blue]: ButtonVariant.Primary,
  [ButtonColor.Black]: ButtonVariant.Primary,
  [ButtonColor.Red]: ButtonVariant.Danger,
  [ButtonColor.RedOutline]: ButtonVariant.DangerOutline,
  [ButtonColor.BlueOutline]: ButtonVariant.AccentOutline,
  [ButtonColor.Light]: ButtonVariant.Soft,
  [ButtonColor.Transparent]: ButtonVariant.Ghost,
  [ButtonColor.White]: ButtonVariant.Default,
};

// A string union, not an enum, because the pages written against the shared
// button pass these as literals.
export type ButtonSize = "small" | "medium" | "large";

export const buttonVariants = cva(
  "relative box-border items-center justify-center gap-1.5 rounded-md border text-body font-medium transition-colors duration-fast focus-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        [ButtonVariant.Primary]:
          "border-accent bg-accent text-accent-fg not-disabled:hover:border-accent-hover not-disabled:hover:bg-accent-hover",
        [ButtonVariant.Default]:
          "border-line-strong bg-surface text-fg not-disabled:hover:bg-surface-2",
        [ButtonVariant.Soft]:
          "border-line bg-surface-2 text-fg not-disabled:hover:bg-line",
        [ButtonVariant.Ghost]:
          "border-transparent bg-transparent text-fg not-disabled:hover:bg-line",
        [ButtonVariant.Danger]:
          "border-danger bg-danger text-on-danger not-disabled:hover:border-danger-hover not-disabled:hover:bg-danger-hover",
        [ButtonVariant.DangerOutline]:
          "border-danger bg-surface text-danger not-disabled:hover:bg-danger-soft",
        [ButtonVariant.AccentOutline]:
          "border-accent bg-surface text-accent not-disabled:hover:bg-accent-soft",
      },
      size: {
        small: "min-h-control-sm px-2.5 py-1",
        medium: "min-h-control px-3 py-1",
        large: "min-h-10 px-4 py-2 text-heading",
      } satisfies Record<ButtonSize, string>,
    },
  },
);

type ButtonProps = React.PropsWithChildren &
  React.AriaAttributes & {
    className?: string;
    variant?: ButtonVariant;
    /** Ignored when `variant` is set. */
    color?: ButtonColor;
    title?: string;
    disabled?: boolean;
    size?: ButtonSize;
  } & (
    | ({
        to?: never;
        ref?: React.RefObject<HTMLButtonElement | null>;
      } & Pick<
        React.HTMLAttributes<HTMLButtonElement>,
        "onMouseEnter" | "onMouseLeave" | "onKeyDown" | "onPointerDown"
      > &
        (
          | {
              type: "submit";
              onClick?: (e: React.FormEvent) => void;
            }
          | {
              type?: "button" | "reset";
              onClick: (e: React.MouseEvent<HTMLElement>) => void;
            }
        ))
    | {
        to: string;
        ref?: never;
        type?: never;
        onClick?: never;
        onMouseEnter?: never;
        onMouseLeave?: never;
        onKeyDown?: never;
        onPointerDown?: never;
      }
  );

const Button: React.FC<ButtonProps> = ({
  ref,
  title,
  onClick,
  children,
  className,
  variant,
  color = ButtonColor.White,
  type = "button",
  disabled = false,
  onMouseEnter,
  onMouseLeave,
  onKeyDown,
  onPointerDown,
  size = "medium",
  to,
  ...rest
}) => {
  const classes = cn(
    // Block-level and sized to its content, as the shared button was, so the
    // pages laid out around it keep their flow.
    "flex w-fit",
    buttonVariants({ variant: variant ?? VARIANT_OF_COLOR[color], size }),
    disabled && "cursor-not-allowed opacity-50",
    className,
  );

  if (to !== undefined) {
    return (
      <Link {...rest} to={to} title={title} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      title={title}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    >
      {children}
    </button>
  );
};

export default Button;
