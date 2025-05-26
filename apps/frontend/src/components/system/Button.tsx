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
  );

export enum ButtonColor {
  Stone = "bg-stone-700",
  Green = "bg-green-500",
  Red = "bg-red-500",
  Light = "bg-stone-200",
  Blue = "bg-[#318dde]",
  Yellow = "bg-yellow-600",
  Transparent = "transparent",
  Grey = "bg-gray-200 !text-black",
}

const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  className,
  color: colorProp,
  type = "button",
  disabled = false,
}) => {
  const color = colorProp ?? ButtonColor.Stone;
  return (
    <button
      type={type}
      className={`px-4 py-2 w-fit h-fit rounded flex items-center justify-center ${className} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-${ButtonColorClasses[color]}-100"} font-newsreader ${
        color === ButtonColor.Transparent
          ? "bg-transparent text-black hover:bg-black/10"
          : "text-white"
      }  ${color} ${color === ButtonColor.Light ? "!text-stone-800" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
