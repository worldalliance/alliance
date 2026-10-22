import { CardStyle, cardStyleClasses } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { PropsWithChildren } from "react";

export interface CardProps extends PropsWithChildren {
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: CardStyle;
  bgImage?: string;
  ref?: React.RefObject<HTMLDivElement | null>;
  flex?: boolean;
  id?: string;
  "data-walkthrough"?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  onClick,
  style,
  bgImage,
  ref,
  flex = true,
  id,
  "data-walkthrough": dataWalkthrough,
}: CardProps) => {
  const cardStyle = style ?? CardStyle.White;

  return (
    <div
      id={id || undefined}
      data-walkthrough={dataWalkthrough}
      className={cn(
        flex && "flex flex-col",
        cardStyleClasses[cardStyle],
        "p-4 border",
        onClick && "cursor-pointer",
        "bg-cover bg-center rounded",
        className,
      )}
      ref={ref}
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
