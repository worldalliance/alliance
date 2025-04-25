import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  color?: ButtonColor;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export enum ButtonColor {
  Stone = "bg-stone-700",
  Green = "bg-green-500",
  Red = "bg-red-500",
  Blue = "bg-cyan-600",
  Transparent = "transparent",
  Grey = "bg-gray-200 !text-black",
}

const ButtonColorClasses: Record<ButtonColor, string> = {
  [ButtonColor.Stone]: "stone",
  [ButtonColor.Green]: "green",
  [ButtonColor.Red]: "red",
  [ButtonColor.Blue]: "blue",
  [ButtonColor.Transparent]: "transparent",
  [ButtonColor.Grey]: "gray",
};

const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  className,
  color: colorProp,
  type = "button",
  disabled = false,
}) => {
  const color = colorProp ?? ButtonColor.Stone;
  return (
    <button
      type={type}
      className={`px-3 py-1 w-fit h-fit rounded ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-${ButtonColorClasses[color]}-100'} font-newsreader ${
        color === ButtonColor.Transparent
          ? "bg-transparent text-black hover:bg-black/10 pt-2"
          : "text-white py-2 pt-3"
      }  ${color} `}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export default Button;
