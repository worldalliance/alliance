import { PropsWithChildren } from "react";

export enum CardStyle {
  White = "white",
  Outline = "outline",
  Alert = "alert",
  Grey = "grey",
  Black = "black",
  Image = "image",
  Green = "green",
}

export interface CardProps extends PropsWithChildren {
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: CardStyle;
  bgImage?: string;
  closed?: boolean;
  ref?: React.RefObject<HTMLDivElement | null>;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  onClick,
  style,
  bgImage,
  closed,
  ref,
}: CardProps) => {
  const cardStyle = style ?? CardStyle.White;

  const styleClasses = {
    [CardStyle.White]:
      "bg-white border-zinc-200 transition-[border] duration-100 border-box rounded-lg",
    [CardStyle.Alert]: "bg-sky-100 border-sky-300",
    [CardStyle.Outline]: "bg-transparent border-gray-300",
    [CardStyle.Grey]: "bg-stone-200/75 border-gray-300 border-[1.5px]",
    [CardStyle.Black]: "bg-black border-gray-300 text-white",
    [CardStyle.Image]: "bg-transparent border-none",
    [CardStyle.Green]: "bg-[#daedcc] border-[#5d9c2d] rounded-lg",
  };

  return (
    <div
      className={`flex flex-col ${
        styleClasses[cardStyle]
      } gap-y-2 rounded p-4 border ${className} ${
        onClick
          ? "cursor-pointer hover:border-black transition-[border] duration-100"
          : ""
      } bg-cover bg-center`}
      ref={ref}
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        height: closed ? "0px" : "calc-size(auto, size)",
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
