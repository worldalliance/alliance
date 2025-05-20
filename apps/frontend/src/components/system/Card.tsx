import { PropsWithChildren } from "react";

export enum CardStyle {
  White = "white",
  Outline = "outline",
  Alert = "alert",
  Grey = "grey",
  Black = "black",
  Image = "image",
}

export interface CardProps extends PropsWithChildren {
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: CardStyle;
  bgImage?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  onClick,
  style,
  bgImage,
}) => {
  const cardStyle = style ?? CardStyle.White;

  const styleClasses = {
    [CardStyle.White]:
      "bg-white border-gray-300 transition-[border] duration-100 border-box",
    [CardStyle.Alert]: "bg-sky-100 border-sky-300",
    [CardStyle.Outline]: "bg-transparent border-gray-300",
    [CardStyle.Grey]: "bg-stone-200/75 border-gray-300 border-[1.5px]",
    [CardStyle.Black]: "bg-black border-gray-300 text-white",
    [CardStyle.Image]: "bg-transparent border-none",
  };

  return (
    <div
      className={`flex flex-col ${styleClasses[cardStyle]} gap-y-2 rounded-lg p-4 border ${className} ${onClick ? "cursor-pointer hover:border-black transition-[border] duration-100" : ""} bg-cover bg-center`}
      style={{ backgroundImage: `url(${bgImage})` }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
