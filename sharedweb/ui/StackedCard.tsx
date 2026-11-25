import type { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import type { ReactNode } from "react";

interface StackedCardProps {
  top: ReactNode;
  topCardStyle: CardStyle;
  topCardClassName?: string;

  bottom: ReactNode;
  bottomCardStyle: CardStyle;
  bottomCardClassName?: string;
}

const StackedCard = ({
  top,
  topCardStyle,
  topCardClassName,
  bottom,
  bottomCardStyle,
  bottomCardClassName,
}: StackedCardProps) => {
  return (
    <div>
      {top && (
        <Card
          style={topCardStyle}
          className={cn("rounded-b-none", topCardClassName)}
        >
          {top}
        </Card>
      )}
      {bottom && (
        <Card
          style={bottomCardStyle}
          className={cn(
            top && "border-t-0 rounded-t-none",
            bottomCardClassName,
          )}
        >
          {bottom}
        </Card>
      )}
    </div>
  );
};

export default StackedCard;
