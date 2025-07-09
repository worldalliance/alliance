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
  Stone = "bg-[#444] text-white hover:bg-[#333]",
  Green = "bg-[#5d9c2d] text-white",
  Red = "bg-red-100 !text-red-500",
  Light = "bg-stone-200",
  Blue = "bg-[#318dde] text-white",
  Yellow = "bg-yellow-600",
  Transparent = "transparent",
  Grey = "bg-gray-200 !text-black",
  Outline = "border border-stone-300 text-black",
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
      className={`px-4 py-[8px] w-fit h-fit rounded flex items-center justify-center ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-${ButtonColorClasses[color]}-100"
      } ${color} ${
        color === ButtonColor.Light ? "!text-stone-800" : ""
      } ${className} `}
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
