import React from "react";

type ButtonProps = React.PropsWithChildren & {
  ref?: React.RefObject<HTMLButtonElement | null>;
  className?: string;
  color?: ButtonColor;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
} & (
    | {
        type: "submit";
        onClick?: (e: React.FormEvent) => void;
      }
    | {
        type?: "button" | "reset";
        onClick: (e: React.MouseEvent<HTMLElement>) => void;
      }
  ) &
  Pick<
    React.HTMLAttributes<HTMLButtonElement>,
    "onMouseEnter" | "onMouseLeave"
  >;

export enum ButtonColor {
  Stone = "bg-gray-4 text-white hover:bg-[#444]",
  Green = "bg-green text-white hover:bg-[#4d8c1d]",
  GreenOutLine = "border border-green text-green hover:bg-green/10",
  Red = "bg-red-100 !text-red-500",
  RedOutline = "border border-red-500 text-red-500",
  Light = "bg-zinc-200/60",
  LightHover = "bg-zinc-200/60 hover:bg-zinc-200/80 !text-zinc-500",
  Blue = "bg-[#318dde] text-white",
  BlueOutline = "border border-[#318dde] text-[#318dde] hover:bg-[#318dde]/10",
  Yellow = "bg-yellow-600",
  Transparent = "bg-transparent hover:bg-zinc-100 text-black",
  Grey = "bg-gray-200 !text-black",
  Outline = "border border-gray-2 text-black",
  White = "border border-gray-2 text-black bg-white hover:bg-zinc-50",
  Black = "bg-zinc-800 hover:bg-zinc-900 text-white",
}

const Button: React.FC<ButtonProps> = ({
  ref,
  onClick,
  children,
  className,
  color: colorProp,
  type = "button",
  disabled = false,
  onMouseEnter,
  onMouseLeave,
  size = "medium",
}) => {
  const color = colorProp ?? ButtonColor.White;

  const sizeClass = {
    small: "px-3 py-1.5 text-xs",
    medium: "px-4 py-2 text-sm",
    large: "px-6 py-3 text-base",
  }[size];

  return (
    <button
      ref={ref}
      type={type}
      className={` ${sizeClass} font-medium rounded w-fit h-fit flex items-center justify-center ${
        disabled ? "opacity-50 !cursor-not-allowed" : ``
      } ${color} ${
        color === ButtonColor.Light ? "!text-zinc-800" : ""
      } ${className} `}
      style={{
        fontWeight: 450,
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
};

export default Button;
