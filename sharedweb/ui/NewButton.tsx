import { type LucideIcon } from "lucide-react";
import React from "react";
import { isNullReactNode, NullReactNode } from "@alliance/shared/lib/constants";
import { cn } from "@alliance/shared/styles/util";

type ButtonProps = React.PropsWithChildren & {
  className?: string;
  color?: ButtonColor;
  hoverText?: string;
  title?: string;
  disabled?: boolean;
  size?: "small" | "medium" | "large" | "mediumDynamic";
  iconLeft?: LucideIcon | NullReactNode;
  iconRight?: LucideIcon | NullReactNode;
} & (
    | ({
        asDiv?: false;
        ref?: React.RefObject<HTMLButtonElement | null>;
      } & Pick<
        React.HTMLAttributes<HTMLButtonElement>,
        "onMouseEnter" | "onMouseLeave"
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
    | ({
        asDiv: true;
        ref?: React.RefObject<HTMLDivElement | null>;
        type?: "button" | "reset";
        onClick: (e: React.MouseEvent<HTMLElement>) => void;
      } & Pick<
        React.HTMLAttributes<HTMLDivElement>,
        "onMouseEnter" | "onMouseLeave"
      >)
  );

export enum ButtonColor {
  Stone = "bg-gray-4 text-white hover:bg-[#444] border border-[#444]",
  Green = "bg-green text-white hover:bg-[#4d8c1d] border border-green",
  GreenOutLine = "border border-green text-green hover:bg-green/10",
  Red = "bg-red-100 !text-red-500 hover:bg-red-200",
  RedOutline = "border border-red-500 text-red-500",
  Light = "bg-zinc-200/60 border border-[#efeff1]",
  LightHover = "bg-zinc-200/60 hover:bg-zinc-200/80 !text-zinc-500",
  Blue = "bg-[#318dde] text-white border border-[#318dde]",
  BlueOutline = "border border-[#318dde] text-[#318dde] hover:bg-[#318dde]/10",
  Yellow = "bg-yellow-600",
  Transparent = "bg-transparent hover:bg-black/5 text-black !px-2",
  TransparentMuted = "bg-transparent hover:bg-black/5 text-zinc-600 hover:text-zinc-900 !px-2",
  Grey = "bg-zinc-200 !text-black hover:bg-zinc-300",
  Outline = "border border-gray-2 text-black",
  White = "border border-gray-2 text-black bg-white hover:bg-zinc-50",
  Black = "bg-zinc-800 hover:bg-zinc-900 text-white border border-zinc-800 active:bg-zinc-700",
}

const TOOLTIP_CLASSNAME =
  "absolute -top-[110%] left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-black/50 text-white text-sm p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150";

const Button: React.FC<ButtonProps> = ({
  ref,
  title,
  onClick,
  children,
  className,
  color = ButtonColor.White,
  type = "button",
  disabled = false,
  onMouseEnter,
  hoverText,
  onMouseLeave,
  size = "medium",
  iconLeft: IconLeft,
  iconRight: IconRight,
  asDiv,
}) => {
  const sizeClass = {
    small: "px-3 py-1.5 text-sm h-9 gap-x-1",
    medium: "px-4 py-2 text-base h-10 gap-x-2",
    mediumDynamic: "px-2 md:px-4 py-1 md:py-1.5 text-base h-10 gap-x-2",
    large: "px-6 py-3 text-lg h-12 gap-x-3",
  }[size];

  const baseClassName = cn(
    sizeClass,
    "font-medium rounded w-fit flex flex-row items-center justify-between box-border relative group",
    disabled && "opacity-50 !cursor-not-allowed",
    color,
    color === ButtonColor.Light && "!text-zinc-800",
    className
  );

  const iconSize = {
    small: 12,
    medium: 18,
    mediumDynamic: 18,
    large: 24,
  }[size];

  const baseStyle = {
    fontWeight: 450,
  };

  if (asDiv) {
    return (
      <div
        ref={ref}
        title={title}
        className={cn(baseClassName, !disabled && "cursor-pointer")}
        style={baseStyle}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div>
          {!isNullReactNode(IconLeft) && <IconLeft size={iconSize} />}
          {children}
          {!isNullReactNode(IconRight) && <IconRight size={iconSize} />}
        </div>
        {hoverText && <div className={TOOLTIP_CLASSNAME}>{hoverText}</div>}
      </div>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      title={title}
      className={baseClassName}
      style={baseStyle}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {!isNullReactNode(IconLeft) && <IconLeft size={iconSize} />}
      <div className="w-full">{children}</div>
      {!isNullReactNode(IconRight) && <IconRight size={iconSize} />}
      {hoverText && <div className={TOOLTIP_CLASSNAME}>{hoverText}</div>}
    </button>
  );
};

export default Button;
