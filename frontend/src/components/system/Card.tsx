import { PropsWithChildren } from "react";

export enum CardStyle {
  White = "white",
  Outline = "outline",
  Alert = "alert",
  Grey = "grey",
  Bubble = "bubble",
}

export interface CardProps extends PropsWithChildren {
  className?: string;
  onClick?: () => void;
  style?: CardStyle;
}

const Card: React.FC<CardProps> = ({ children, className, onClick, style }) => {
  const cardStyle = style ?? CardStyle.White;

  const styleClasses = {
    [CardStyle.White]: "bg-white border-gray-200",
    [CardStyle.Alert]: "bg-sky-100 border-sky-300 shadow-md",
    [CardStyle.Outline]: "bg-transparent border-gray-200",
    [CardStyle.Grey]: "bg-stone-200/75 border-gray-300 border-[1.5px]",
    [CardStyle.Bubble]:
      "!rounded-full bg-stone-200 border-gray-300 border-[1.5px] items-center justify-center text-center text-[9pt] max-w-[200px]",
  };

  return (
    <div
      className={`flex flex-col ${styleClasses[cardStyle]} gap-y-2 rounded-lg p-4 border ${className} ${onClick ? "cursor-pointer hover:border-black transition-all duration-300" : ""}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
