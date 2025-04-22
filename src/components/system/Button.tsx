import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  color?: ButtonColor;
}

export enum ButtonColor {
  Stone = "bg-stone-500",
  Green = "bg-green-500",
  Red = "bg-red-500",
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
      className={`px-3 py-1 pt-2 ${ButtonColorClasses[color]} rounded ${className} cursor-pointer hover:bg-${ButtonColorClasses[color]}-100 font-newsreader ${
        color === ButtonColor.Transparent
          ? "bg-transparent text-black hover:bg-black/10"
          : "text-white py-2 bg-stone-500"
      }`}
      onClick={onClick}
    >
      {label}
    </div>
  );
};

export default Button;
