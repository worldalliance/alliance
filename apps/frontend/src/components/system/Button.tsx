import React from "react";

type ButtonProps = React.PropsWithChildren & {
  className?: string;
  color?: ButtonColor;
  disabled?: boolean;
} & (
    | {
        type: "submit";
        onClick?: (e: React.FormEvent) => void;
      }
    | {
        type?: "button" | "reset";
        onClick: (e: React.MouseEvent) => void;
      }
  ) &
  Pick<
    React.HTMLAttributes<HTMLButtonElement>,
    "onMouseEnter" | "onMouseLeave"
  >;

export enum ButtonColor {
  Stone = "bg-[#444]",
  Green = "bg-[#5d9c2d]",
  Red = "bg-red-100 !text-red-500",
  Light = "bg-stone-200",
  Blue = "bg-[#318dde]",
  Yellow = "bg-yellow-600",
  Transparent = "transparent",
  Grey = "bg-gray-200 !text-black",
  Outline = "border border-stone-300",
}

const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  className,
  color: colorProp,
  type = "button",
  disabled = false,
  onMouseEnter,
  onMouseLeave,
}) => {
  const color = colorProp ?? ButtonColor.Stone;
  return (
    <button
      type={type}
      className={`px-4 py-[8px] pt-[10px] w-fit h-fit rounded flex items-center justify-center ${className} ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-${ButtonColorClasses[color]}-100"
      } ${
        color === ButtonColor.Transparent
          ? "bg-transparent text-black hover:bg-black/10"
          : "text-white"
      }  ${color} ${color === ButtonColor.Light ? "!text-stone-800" : ""}`}
      onClick={onClick}
      disabled={disabled}
      style={{ fontWeight: 450 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
};

export default Button;
