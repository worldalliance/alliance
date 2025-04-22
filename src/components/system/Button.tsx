import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  color?: ButtonColor;
}

export enum ButtonColor {
  Stone = "stone",
  Green = "green",
  Red = "red",
  Transparent = "transparent",
}

const ButtonColorClasses: Record<ButtonColor, string> = {
  [ButtonColor.Stone]: "stone",
  [ButtonColor.Green]: "green",
  [ButtonColor.Red]: "red",
  [ButtonColor.Transparent]: "transparent",
};

const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  className,
  color: colorProp,
}) => {
  const color = colorProp ?? ButtonColor.Stone;
  return (
    <div
      className={`px-3 py-1 bg-${ButtonColorClasses[color]}-500 rounded ${className} cursor-pointer hover:bg-${ButtonColorClasses[color]}-100 ${
        color === ButtonColor.Transparent
          ? "bg-transparent text-black hover:bg-black/10 font-avenir font-bold"
          : "text-white py-2"
      }`}
      onClick={onClick}
    >
      {label}
    </div>
  );
};

export default Button;
