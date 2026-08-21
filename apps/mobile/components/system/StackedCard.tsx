import type { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { View } from "react-native";
import Card from "./Card";

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
    <View>
      {top ? (
        <Card
          cardStyle={topCardStyle}
          className={cn(
            "border border-zinc-200 rounded-b-none",
            topCardClassName,
          )}
        >
          {top}
        </Card>
      ) : null}
      {bottom ? (
        <Card
          cardStyle={bottomCardStyle}
          className={cn(
            "border border-zinc-200",
            top && "border-t-0 rounded-t-none",
            bottomCardClassName,
          )}
        >
          {bottom}
        </Card>
      ) : null}
    </View>
  );
};

export default StackedCard;
