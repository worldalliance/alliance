import { CardStyle } from "@alliance/shared/styles/card";
import { PropsWithChildren } from "react";
import { cn } from "./cn";

// Keyed by the shared enum because callers pass it; the member app's seventeen
// styles come down to the few surfaces the admin has.
const STYLE: Record<CardStyle, string> = {
  [CardStyle.White]: "border-line bg-surface",
  [CardStyle.WhiteBorder]: "border-line bg-surface",
  [CardStyle.WhiteSolid]: "border-line bg-surface",
  [CardStyle.Image]: "border-transparent bg-transparent",
  [CardStyle.Outline]: "border-line bg-transparent",
  [CardStyle.Transparent]: "border-line bg-transparent",
  [CardStyle.Grey]: "border-line bg-surface-2",
  [CardStyle.GreyBorder]: "border-line bg-surface-2",
  [CardStyle.LightGrey]: "border-line bg-surface-2",
  [CardStyle.LightGreyBorder]: "border-line bg-surface-2",
  [CardStyle.Black]: "border-fg bg-fg text-accent-fg",
  [CardStyle.Navy]: "border-primary bg-primary text-on-primary",
  [CardStyle.Alert]: "border-info bg-info-soft",
  [CardStyle.Green]: "border-success bg-success-soft",
  [CardStyle.LightGreen]: "border-success bg-success-soft",
  [CardStyle.Red]: "border-danger bg-danger-soft",
  [CardStyle.Orange]: "border-warning bg-warning-soft",
};

export interface CardProps extends PropsWithChildren {
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: CardStyle;
  ref?: React.RefObject<HTMLDivElement | null>;
  flex?: boolean;
  id?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  onClick,
  style = CardStyle.White,
  ref,
  flex = true,
  id,
}: CardProps) => (
  <div
    id={id || undefined}
    className={cn(
      flex && "flex flex-col",
      "rounded-card border p-card",
      STYLE[style],
      onClick && "cursor-pointer",
      className,
    )}
    ref={ref}
    onClick={onClick}
  >
    {children}
  </div>
);

export default Card;
